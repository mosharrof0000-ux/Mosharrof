const MAX_SAMPLE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_CHARS = 800;
const MAX_REFERENCE_TEXT_CHARS = 500;
const AUDIO_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave", "audio/flac", "audio/ogg"]);
const PROFILE_COLUMNS = "id, serial_id, name, language, provider_id, status, consent_voice_use, consent_sample_storage, consent_model_training, sample_mime_type, sample_bytes, created_at, updated_at";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
  });
}

function asProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    serial: "VOICE-" + String(row.serial_id).padStart(3, "0"),
    name: row.name,
    language: row.language,
    provider: row.provider_id || "indicf5",
    status: row.status,
    consent: {
      voice_use: !!row.consent_voice_use,
      sample_storage: !!row.consent_sample_storage,
      model_training: !!row.consent_model_training
    },
    sample: row.sample_mime_type ? { mime_type: row.sample_mime_type, bytes: row.sample_bytes } : null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function db(env) { return env.PERSONAL_VOICE_DB || null; }
function bucket(env) { return env.PERSONAL_VOICE_BUCKET || null; }

function configuredBase(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return url;
  } catch { return null; }
}

async function authenticatedUser(request, env) {
  const base = configuredBase(env.SUPABASE_URL);
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "").trim();
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer ([\x21-\x7e]{20,8192})$/);
  if (!base || !key || !match) return null;
  try {
    const response = await fetch(new URL("/auth/v1/user", base), {
      headers: { apikey: key, authorization: "Bearer " + match[1], accept: "application/json" },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return null;
    const user = await response.json();
    return typeof user?.id === "string" && user.id ? user : null;
  } catch { return null; }
}

function encryptionKey(env) {
  const raw = String(env.PERSONAL_VOICE_ENCRYPTION_KEY || "").trim();
  if (!raw) return null;
  try {
    const bytes = Uint8Array.from(atob(raw), char => char.charCodeAt(0));
    return bytes.length === 32 ? bytes : null;
  } catch { return null; }
}

async function encryptSample(raw, env) {
  const keyBytes = encryptionKey(env);
  if (!keyBytes) throw new Error("voice_encryption_not_configured");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, raw));
  const packed = new Uint8Array(iv.length + ciphertext.length);
  packed.set(iv, 0);
  packed.set(ciphertext, iv.length);
  return packed;
}

async function decryptSample(packed, env) {
  const keyBytes = encryptionKey(env);
  if (!keyBytes || packed.byteLength < 29) throw new Error("voice_sample_unavailable");
  const bytes = new Uint8Array(packed);
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext));
}

async function ownedProfile(database, ownerId, profileId) {
  return database.prepare(
    "SELECT " + PROFILE_COLUMNS + ", sample_object_key, reference_text FROM personal_voice_profiles WHERE owner_id = ? AND id = ? AND deleted_at IS NULL"
  ).bind(ownerId, profileId).first();
}

function providerAvailability(env, provider) {
  if (provider === "edge") return !!env.EDGE_TTS_API_URL;
  if (provider === "azure") return !!env.AZURE_SPEECH_KEY && !!env.AZURE_SPEECH_REGION;
  if (provider === "gemini") return !!(env.GEMINI_API_KEY || env.GEMINI_API_KEY_2 || env.GEMINI_API_KEY_3 || env.GEMINI_API_KEY_4 || env.GEMINI_API_KEY_5);
  if (provider === "sarvam") return !!env.SARVAM_API_KEY;
  if (provider === "elevenlabs") return !!env.ELEVENLABS_API_KEY;
  return false;
}

async function profilesRoute(request, env, user, url) {
  const database = db(env);
  if (!database) return json({ error: "personal_voice_database_not_configured" }, 503);
  if (request.method === "GET" && url.pathname === "/personal-voice/profiles") {
    const result = await database.prepare(
      "SELECT " + PROFILE_COLUMNS + " FROM personal_voice_profiles WHERE owner_id = ? AND deleted_at IS NULL ORDER BY serial_id"
    ).bind(user.id).all();
    const pref = await database.prepare("SELECT default_profile_id FROM personal_voice_preferences WHERE owner_id = ?").bind(user.id).first();
    return json({ profiles: (result.results || []).map(asProfile), default_profile_id: pref?.default_profile_id || null });
  }

  if (request.method === "POST" && url.pathname === "/personal-voice/profiles") {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 8192) return json({ error: "request_too_large" }, 413);
    const body = await request.json().catch(() => null);
    const name = String(body?.name || "").trim().slice(0, 80);
    const language = String(body?.language || "bn-BD").trim().slice(0, 16);
    const consent = body?.consent || {};
    if (!name || !/^[a-zA-Z0-9_-]+(?:-[a-zA-Z0-9_-]+)*$/.test(language)) return json({ error: "valid_name_and_language_required" }, 400);
    if (consent.voice_use !== true || consent.sample_storage !== true) return json({ error: "explicit_voice_use_and_sample_storage_consent_required" }, 400);
    const serial = await database.prepare("INSERT INTO personal_voice_serials DEFAULT VALUES").run();
    const serialId = Number(serial.meta?.last_row_id || 0);
    if (!Number.isSafeInteger(serialId) || serialId < 1) return json({ error: "serial_allocation_failed" }, 500);
    const inserted = await database.prepare(
      "INSERT INTO personal_voice_profiles (owner_id, serial_id, name, language, status, consent_voice_use, consent_sample_storage, consent_model_training) VALUES (?, ?, ?, ?, 'draft', 1, 1, ?)"
    ).bind(user.id, serialId, name, language, consent.model_training === true ? 1 : 0).run();
    const id = Number(inserted.meta?.last_row_id || 0);
    const row = await ownedProfile(database, user.id, id);
    return json({ profile: asProfile(row) }, 201);
  }

  const preferenceMatch = url.pathname === "/personal-voice/preferences/default";
  if (preferenceMatch && request.method === "PUT") {
    const body = await request.json().catch(() => null);
    const profileId = Number(body?.profile_id);
    if (!Number.isSafeInteger(profileId) || profileId < 1) return json({ error: "valid_profile_id_required" }, 400);
    const profile = await ownedProfile(database, user.id, profileId);
    if (!profile || profile.status !== "active" || !profile.sample_object_key || !profile.consent_voice_use) return json({ error: "active_owned_voice_profile_required" }, 404);
    await database.prepare(
      "INSERT INTO personal_voice_preferences (owner_id, default_profile_id) VALUES (?, ?) ON CONFLICT(owner_id) DO UPDATE SET default_profile_id = excluded.default_profile_id, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')"
    ).bind(user.id, profileId).run();
    return json({ ok: true, default_profile_id: profileId });
  }

  const match = url.pathname.match(/^\/personal-voice\/profiles\/(\d+)(?:\/(sample|synthesize))?$/);
  if (!match) return json({ error: "personal_voice_route_not_found" }, 404);
  const profileId = Number(match[1]);
  if (!Number.isSafeInteger(profileId) || profileId < 1) return json({ error: "invalid_profile_id" }, 400);
  const action = match[2] || "";
  const profile = await ownedProfile(database, user.id, profileId);
  if (!profile) return json({ error: "voice_profile_not_found" }, 404);

  if (action === "sample" && request.method === "POST") {
    if (!bucket(env)) return json({ error: "personal_voice_storage_not_configured" }, 503);
    if (!encryptionKey(env)) return json({ error: "voice_encryption_not_configured" }, 503);
    if (!profile.consent_voice_use || !profile.consent_sample_storage) return json({ error: "voice_and_storage_consent_required" }, 403);
    const form = await request.formData().catch(() => null);
    const file = form?.get("reference_audio");
    const referenceText = String(form?.get("reference_text") || "").trim();
    if (!file || typeof file.arrayBuffer !== "function" || !AUDIO_TYPES.has(String(file.type || "").toLowerCase())) return json({ error: "supported_audio_file_required" }, 415);
    if (!referenceText || referenceText.length > MAX_REFERENCE_TEXT_CHARS) return json({ error: "reference_text_required_and_limited_to_500_chars" }, 400);
    if (file.size < 1 || file.size > MAX_SAMPLE_BYTES) return json({ error: "audio_must_be_under_5_mib" }, 413);
    const raw = new Uint8Array(await file.arrayBuffer());
    const objectKey = user.id + "/" + profileId + "/" + crypto.randomUUID() + ".enc";
    const encrypted = await encryptSample(raw, env);
    await bucket(env).put(objectKey, encrypted, {
      httpMetadata: { contentType: "application/octet-stream", cacheControl: "private, no-store" },
      customMetadata: { encryption: "AES-256-GCM", sourceType: String(file.type).toLowerCase() }
    });
    if (profile.sample_object_key) await bucket(env).delete(profile.sample_object_key);
    await database.prepare(
      "UPDATE personal_voice_profiles SET sample_object_key = ?, sample_mime_type = ?, sample_bytes = ?, reference_text = ?, status = 'active', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE owner_id = ? AND id = ?"
    ).bind(objectKey, String(file.type).toLowerCase(), raw.byteLength, referenceText, user.id, profileId).run();
    const updated = await ownedProfile(database, user.id, profileId);
    return json({ profile: asProfile(updated) }, 200);
  }

  if (action === "synthesize" && request.method === "POST") {
    if (profile.status !== "active" || !profile.sample_object_key || !profile.consent_voice_use || !profile.consent_sample_storage) return json({ error: "active_consented_voice_profile_required" }, 409);
    const inferenceUrl = configuredBase(env.PERSONAL_VOICE_API_URL);
    const inferenceToken = String(env.PERSONAL_VOICE_API_TOKEN || "").trim();
    if (!inferenceUrl || !inferenceToken) return json({ error: "personal_voice_inference_not_configured" }, 503);
    const body = await request.json().catch(() => null);
    const text = String(body?.text || "").trim();
    if (!text || text.length > MAX_TEXT_CHARS) return json({ error: "text_must_be_1_to_800_chars" }, 400);
    const object = await bucket(env).get(profile.sample_object_key);
    if (!object) return json({ error: "voice_sample_not_found" }, 410);
    const decrypted = await decryptSample(await object.arrayBuffer(), env);
    const form = new FormData();
    form.append("text", text);
    form.append("reference_text", profile.reference_text || "");
    form.append("reference_audio", new Blob([decrypted], { type: profile.sample_mime_type || "audio/wav" }), "reference-audio");
    let response;
    try {
      response = await fetch(new URL("/synthesize", inferenceUrl), {
        method: "POST",
        headers: { authorization: "Bearer " + inferenceToken },
        body: form,
        signal: AbortSignal.timeout(120000)
      });
    } catch { return json({ error: "personal_voice_inference_unavailable" }, 502); }
    if (!response.ok) return json({ error: "personal_voice_inference_failed", status: response.status }, 502);
    const audio = new Uint8Array(await response.arrayBuffer());
    if (!audio.length || audio.byteLength > 20 * 1024 * 1024) return json({ error: "invalid_voice_audio_response" }, 502);
    let binary = "";
    for (let offset = 0; offset < audio.length; offset += 0x8000) binary += String.fromCharCode(...audio.subarray(offset, offset + 0x8000));
    return json({ ok: true, provider: "personal-voice", profile_id: profileId, mime_type: "audio/wav", audio_data: btoa(binary) });
  }

  if (action === "" && request.method === "PATCH") {
    const body = await request.json().catch(() => null);
    const name = body?.name === undefined ? profile.name : String(body.name).trim().slice(0, 80);
    if (!name) return json({ error: "valid_name_required" }, 400);
    const consent = body?.consent || {};
    const voiceUse = consent.voice_use === undefined ? !!profile.consent_voice_use : consent.voice_use === true;
    const sampleStorage = consent.sample_storage === undefined ? !!profile.consent_sample_storage : consent.sample_storage === true;
    const training = consent.model_training === undefined ? !!profile.consent_model_training : consent.model_training === true;
    if (!voiceUse || !sampleStorage) {
      if (profile.sample_object_key && !sampleStorage && bucket(env)) await bucket(env).delete(profile.sample_object_key);
      await database.prepare(
        "UPDATE personal_voice_profiles SET name = ?, consent_voice_use = ?, consent_sample_storage = ?, consent_model_training = ?, sample_object_key = ?, sample_mime_type = ?, sample_bytes = ?, reference_text = ?, status = 'revoked', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE owner_id = ? AND id = ?"
      ).bind(name, voiceUse ? 1 : 0, sampleStorage ? 1 : 0, training ? 1 : 0, sampleStorage ? profile.sample_object_key : null, sampleStorage ? profile.sample_mime_type : null, sampleStorage ? profile.sample_bytes : null, sampleStorage ? profile.reference_text : null, user.id, profileId).run();
      await database.prepare("UPDATE personal_voice_preferences SET default_profile_id = NULL WHERE owner_id = ? AND default_profile_id = ?").bind(user.id, profileId).run();
    } else {
      await database.prepare(
        "UPDATE personal_voice_profiles SET name = ?, consent_model_training = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE owner_id = ? AND id = ?"
      ).bind(name, training ? 1 : 0, user.id, profileId).run();
    }
    return json({ profile: asProfile(await ownedProfile(database, user.id, profileId)) });
  }

  if (action === "" && request.method === "DELETE") {
    if (profile.sample_object_key && bucket(env)) await bucket(env).delete(profile.sample_object_key);
    await database.prepare("UPDATE personal_voice_preferences SET default_profile_id = NULL WHERE owner_id = ? AND default_profile_id = ?").bind(user.id, profileId).run();
    await database.prepare("DELETE FROM personal_voice_profiles WHERE owner_id = ? AND id = ?").bind(user.id, profileId).run();
    return json({ ok: true, serial_retained: true });
  }

  return json({ error: "method_not_allowed" }, 405);
}

async function catalogRoute(request, env, user, url) {
  const database = db(env);
  if (!database) return json({ error: "personal_voice_database_not_configured" }, 503);
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const query = String(url.searchParams.get("q") || "").trim().slice(0, 80);
  const language = String(url.searchParams.get("language") || "").trim().slice(0, 16);
  const style = String(url.searchParams.get("style") || "").trim().slice(0, 32);
  const rows = await database.prepare(
    "SELECT id, display_name, language, style, provider_id, provider_voice_id, preview_url, license_status, consent_status FROM personal_voice_catalog WHERE enabled = 1 AND (? = '' OR display_name LIKE '%' || ? || '%' OR provider_voice_id LIKE '%' || ? || '%') AND (? = '' OR language = ?) AND (? = '' OR style = ?) ORDER BY display_name LIMIT 50"
  ).bind(query, query, query, language, language, style, style).all();
  return json({
    voices: (rows.results || []).map(row => ({
      ...row,
      available: providerAvailability(env, row.provider_id),
      license_status: row.license_status,
      consent_status: row.consent_status
    }))
  });
}

export async function handlePersonalVoiceRequest(request, env = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/personal-voice/")) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method === "GET" && url.pathname === "/personal-voice/health") {
    return json({
      ok: true,
      enabled: !!db(env) && !!bucket(env) && !!configuredBase(env.SUPABASE_URL) && !!(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY) && !!encryptionKey(env),
      database_configured: !!db(env),
      private_storage_configured: !!bucket(env) && !!encryptionKey(env),
      auth_configured: !!configuredBase(env.SUPABASE_URL) && !!(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY),
      inference_configured: !!configuredBase(env.PERSONAL_VOICE_API_URL) && !!env.PERSONAL_VOICE_API_TOKEN
    });
  }
  const user = await authenticatedUser(request, env);
  if (!user) return json({ error: "authentication_required" }, 401);
  if (url.pathname === "/personal-voice/catalog") return catalogRoute(request, env, user, url);
  if (url.pathname.startsWith("/personal-voice/profiles") || url.pathname === "/personal-voice/preferences/default") {
    try { return await profilesRoute(request, env, user, url); }
    catch (error) {
      const code = String(error?.message || "");
      if (code.includes("voice_encryption_not_configured")) return json({ error: "voice_encryption_not_configured" }, 503);
      return json({ error: "personal_voice_request_failed" }, 500);
    }
  }
  return json({ error: "personal_voice_route_not_found" }, 404);
}

export const PERSONAL_VOICE_LIMITS = Object.freeze({
  sampleBytes: MAX_SAMPLE_BYTES,
  synthesisTextChars: MAX_TEXT_CHARS,
  referenceTextChars: MAX_REFERENCE_TEXT_CHARS
});
