const MAX_SAMPLE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_CHARS = 800;
const MAX_REFERENCE_TEXT_CHARS = 500;
const AUDIO_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave", "audio/flac", "audio/ogg"]);
const PROFILE_FIELDS = "id,owner_id,voice_serial,name,language,provider_id,status,consent_voice_use,consent_sample_storage,consent_model_training,sample_object_key,sample_mime_type,sample_bytes,reference_text,created_at,updated_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
  });
}

function baseUrl(env) {
  try {
    const url = new URL(String(env.SUPABASE_URL || "").trim());
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return url;
  } catch { return null; }
}

function publishableKey(env) {
  return String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "").trim();
}

async function supabaseFetch(env, token, path, options = {}) {
  const base = baseUrl(env);
  const key = publishableKey(env);
  if (!base || !key) throw new Error("supabase_not_configured");
  const headers = new Headers(options.headers || {});
  headers.set("apikey", key);
  headers.set("authorization", "Bearer " + token);
  headers.set("accept", "application/json");
  if (options.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(new URL(path.replace(/^\//, ""), base.toString().replace(/\/$/, "") + "/"), {
    ...options, headers, signal: options.signal || AbortSignal.timeout(15000)
  });
  return response;
}

async function authenticatedUser(request, env) {
  const base = baseUrl(env);
  const key = publishableKey(env);
  const match = (request.headers.get("authorization") || "").match(/^Bearer ([\x21-\x7e]{20,8192})$/);
  if (!base || !key || !match) return null;
  const token = match[1];
  try {
    const auth = await fetch(new URL("/auth/v1/user", base), {
      headers: { apikey: key, authorization: "Bearer " + token, accept: "application/json" },
      signal: AbortSignal.timeout(10000)
    });
    if (!auth.ok) return null;
    const user = await auth.json();
    if (typeof user?.id !== "string" || !UUID.test(user.id)) return null;

    // Respect the existing MOSHARROF Owner Login authorization contract.
    const ownerCheck = await fetch(new URL("/rest/v1/rpc/asm_is_registered_owner", base), {
      method: "POST",
      headers: { apikey: key, authorization: "Bearer " + token, "content-type": "application/json", accept: "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(10000)
    });
    if (!ownerCheck.ok) return null;
    const value = await ownerCheck.json().catch(() => false);
    const registered = value === true || value?.asm_is_registered_owner === true ||
      (Array.isArray(value) && value.some(row => row === true || row?.asm_is_registered_owner === true));
    return registered ? { user, token } : null;
  } catch { return null; }
}

function asProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    serial: "VOICE-" + String(row.voice_serial).padStart(3, "0"),
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

function encryptionKey(env) {
  const raw = String(env.PERSONAL_VOICE_ENCRYPTION_KEY || "").trim();
  if (!raw) return null;
  try {
    const bytes = Uint8Array.from(atob(raw), char => char.charCodeAt(0));
    return bytes.length === 32 ? bytes : null;
  } catch { return null; }
}

async function encryptSample(raw, env) {
  const bytes = encryptionKey(env);
  if (!bytes) throw new Error("voice_encryption_not_configured");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt"]);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, raw));
  const packed = new Uint8Array(iv.length + encrypted.length);
  packed.set(iv, 0);
  packed.set(encrypted, iv.length);
  return packed;
}

async function decryptSample(packed, env) {
  const bytes = encryptionKey(env);
  if (!bytes || packed.byteLength < 29) throw new Error("voice_sample_unavailable");
  const data = new Uint8Array(packed);
  const key = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["decrypt"]);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: data.slice(0, 12) }, key, data.slice(12)));
}

async function readJson(response) {
  return response.json().catch(() => null);
}

async function getProfile(env, token, ownerId, id) {
  const query = new URLSearchParams({ select: PROFILE_FIELDS, id: "eq." + id, owner_id: "eq." + ownerId, limit: "1" });
  const response = await supabaseFetch(env, token, "rest/v1/personal_voice_profiles?" + query);
  if (!response.ok) throw new Error("profile_lookup_failed");
  const rows = await readJson(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function removeStoredSample(env, token, key) {
  if (!key) return;
  const response = await supabaseFetch(env, token, "storage/v1/object/personal-voice-samples", {
    method: "DELETE",
    body: JSON.stringify({ prefixes: [key] })
  });
  if (!response.ok && response.status !== 404) throw new Error("sample_delete_failed");
}

function providerAvailability(env, provider) {
  if (provider === "edge") return !!env.EDGE_TTS_API_URL;
  if (provider === "azure") return !!env.AZURE_SPEECH_KEY && !!env.AZURE_SPEECH_REGION;
  if (provider === "gemini") return !!(env.GEMINI_API_KEY || env.GEMINI_API_KEY_2 || env.GEMINI_API_KEY_3 || env.GEMINI_API_KEY_4 || env.GEMINI_API_KEY_5);
  if (provider === "sarvam") return !!env.SARVAM_API_KEY;
  if (provider === "elevenlabs") return !!env.ELEVENLABS_API_KEY;
  return false;
}

async function profilesRoute(request, env, auth, url) {
  const { user, token } = auth;
  const path = url.pathname;
  if (request.method === "GET" && path === "/personal-voice/profiles") {
    const query = new URLSearchParams({ select: PROFILE_FIELDS, owner_id: "eq." + user.id, order: "voice_serial.asc" });
    const [profilesResponse, preferenceResponse] = await Promise.all([
      supabaseFetch(env, token, "rest/v1/personal_voice_profiles?" + query),
      supabaseFetch(env, token, "rest/v1/personal_voice_preferences?select=default_profile_id&owner_id=eq." + user.id + "&limit=1")
    ]);
    if (!profilesResponse.ok || !preferenceResponse.ok) throw new Error("profile_list_failed");
    const profiles = await readJson(profilesResponse);
    const preferences = await readJson(preferenceResponse);
    return json({ profiles: (profiles || []).map(asProfile), default_profile_id: preferences?.[0]?.default_profile_id || null });
  }

  if (request.method === "POST" && path === "/personal-voice/profiles") {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 8192) return json({ error: "request_too_large" }, 413);
    const body = await request.json().catch(() => null);
    const name = String(body?.name || "").trim().slice(0, 80);
    const language = String(body?.language || "bn-BD").trim().slice(0, 16);
    const consent = body?.consent || {};
    if (!name || !/^[A-Za-z0-9_-]{2,16}$/.test(language)) return json({ error: "valid_name_and_language_required" }, 400);
    if (consent.voice_use !== true || consent.sample_storage !== true) return json({ error: "explicit_voice_use_and_sample_storage_consent_required" }, 400);
    const response = await supabaseFetch(env, token, "rest/v1/personal_voice_profiles", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        owner_id: user.id, name, language, provider_id: "indicf5", status: "draft",
        consent_voice_use: true, consent_sample_storage: true, consent_model_training: consent.model_training === true
      })
    });
    if (!response.ok) return json({ error: "voice_profile_create_failed" }, 502);
    const rows = await readJson(response);
    return json({ profile: asProfile(rows?.[0]) }, 201);
  }

  if (path === "/personal-voice/catalog/saved" && request.method === "GET") {
    const query = new URLSearchParams({
      select: "id,voice_serial,nickname,catalog_voice_id,personal_voice_catalog(id,display_name,language,style,provider_id,provider_voice_id,license_status,consent_status)",
      owner_id: "eq." + user.id, order: "voice_serial.asc"
    });
    const response = await supabaseFetch(env, token, "rest/v1/personal_voice_saved_catalog?" + query);
    if (!response.ok) return json({ error: "saved_voice_list_failed" }, 502);
    const rows = await readJson(response);
    return json({ voices: (rows || []).map(row => ({
      id: row.id, serial: "VOICE-" + String(row.voice_serial).padStart(3, "0"),
      nickname: row.nickname, catalog_voice_id: row.catalog_voice_id, voice: row.personal_voice_catalog
    })) });
  }

  if (path === "/personal-voice/catalog/saved" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    const catalogId = String(body?.catalog_voice_id || "").slice(0, 100);
    if (!catalogId) return json({ error: "catalog_voice_id_required" }, 400);
    const response = await supabaseFetch(env, token, "rest/v1/personal_voice_saved_catalog", {
      method: "POST", headers: { prefer: "return=representation" },
      body: JSON.stringify({ owner_id: user.id, catalog_voice_id: catalogId, nickname: String(body?.nickname || "").trim().slice(0, 80) || null })
    });
    if (!response.ok) return json({ error: "catalog_voice_save_failed" }, response.status === 409 ? 409 : 502);
    const rows = await readJson(response);
    const row = rows?.[0];
    return json({ voice: row ? { id: row.id, serial: "VOICE-" + String(row.voice_serial).padStart(3, "0"), catalog_voice_id: row.catalog_voice_id } : null }, 201);
  }

  const savedDelete = path.match(/^\/personal-voice\/catalog\/saved\/([0-9a-f-]{36})$/i);
  if (savedDelete && request.method === "DELETE" && UUID.test(savedDelete[1])) {
    const response = await supabaseFetch(env, token, "rest/v1/personal_voice_saved_catalog?id=eq." + savedDelete[1] + "&owner_id=eq." + user.id, { method: "DELETE" });
    if (!response.ok) return json({ error: "saved_voice_delete_failed" }, 502);
    return json({ ok: true, serial_retained: true });
  }

  if (path === "/personal-voice/preferences/default" && request.method === "PUT") {
    const body = await request.json().catch(() => null);
    const profileId = String(body?.profile_id || "");
    if (!UUID.test(profileId)) return json({ error: "valid_profile_id_required" }, 400);
    const profile = await getProfile(env, token, user.id, profileId);
    if (!profile || profile.status !== "active" || !profile.sample_object_key || !profile.consent_voice_use) return json({ error: "active_owned_voice_profile_required" }, 404);
    const response = await supabaseFetch(env, token, "rest/v1/personal_voice_preferences?on_conflict=owner_id", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ owner_id: user.id, default_profile_id: profileId })
    });
    if (!response.ok) return json({ error: "default_voice_update_failed" }, 502);
    return json({ ok: true, default_profile_id: profileId });
  }

  const match = path.match(/^\/personal-voice\/profiles\/([0-9a-f-]{36})(?:\/(sample|synthesize))?$/i);
  if (!match || !UUID.test(match[1])) return json({ error: "personal_voice_route_not_found" }, 404);
  const profileId = match[1];
  const action = match[2] || "";
  const profile = await getProfile(env, token, user.id, profileId);
  if (!profile) return json({ error: "voice_profile_not_found" }, 404);

  if (action === "sample" && request.method === "POST") {
    if (!encryptionKey(env)) return json({ error: "voice_encryption_not_configured" }, 503);
    if (!profile.consent_voice_use || !profile.consent_sample_storage) return json({ error: "voice_and_storage_consent_required" }, 403);
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_SAMPLE_BYTES + 1024 * 1024) return json({ error: "audio_must_be_under_5_mib" }, 413);
    const form = await request.formData().catch(() => null);
    const file = form?.get("reference_audio");
    const referenceText = String(form?.get("reference_text") || "").trim();
    if (!file || typeof file.arrayBuffer !== "function" || !AUDIO_TYPES.has(String(file.type || "").toLowerCase())) return json({ error: "supported_audio_file_required" }, 415);
    if (!referenceText || referenceText.length > MAX_REFERENCE_TEXT_CHARS) return json({ error: "reference_text_required_and_limited_to_500_chars" }, 400);
    if (file.size < 1 || file.size > MAX_SAMPLE_BYTES) return json({ error: "audio_must_be_under_5_mib" }, 413);
    const raw = new Uint8Array(await file.arrayBuffer());
    const objectKey = user.id + "/" + profileId + "/" + crypto.randomUUID() + ".enc";
    const encrypted = await encryptSample(raw, env);
    const upload = await supabaseFetch(env, token, "storage/v1/object/personal-voice-samples/" + objectKey.split("/").map(encodeURIComponent).join("/"), {
      method: "POST",
      headers: { "content-type": "application/octet-stream", "x-upsert": "false" },
      body: encrypted
    });
    if (!upload.ok) return json({ error: "private_voice_sample_upload_failed" }, 502);
    if (profile.sample_object_key) await removeStoredSample(env, token, profile.sample_object_key);
    const update = await supabaseFetch(env, token, "rest/v1/personal_voice_profiles?id=eq." + profileId + "&owner_id=eq." + user.id, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        sample_object_key: objectKey, sample_mime_type: String(file.type).toLowerCase(),
        sample_bytes: raw.byteLength, reference_text: referenceText, status: "active"
      })
    });
    if (!update.ok) {
      await removeStoredSample(env, token, objectKey);
      return json({ error: "voice_profile_sample_link_failed" }, 502);
    }
    const rows = await readJson(update);
    return json({ profile: asProfile(rows?.[0]) });
  }

  if (action === "synthesize" && request.method === "POST") {
    if (profile.status !== "active" || !profile.sample_object_key || !profile.consent_voice_use || !profile.consent_sample_storage) return json({ error: "active_consented_voice_profile_required" }, 409);
    if (!encryptionKey(env)) return json({ error: "voice_encryption_not_configured" }, 503);
    const inferenceUrl = (() => { try { const value = new URL(String(env.PERSONAL_VOICE_API_URL || "")); return value.protocol === "https:" && !value.username && !value.password ? value : null; } catch { return null; } })();
    const inferenceToken = String(env.PERSONAL_VOICE_API_TOKEN || "").trim();
    if (!inferenceUrl || !inferenceToken) return json({ error: "personal_voice_inference_not_configured" }, 503);
    const body = await request.json().catch(() => null);
    const text = String(body?.text || "").trim();
    if (!text || text.length > MAX_TEXT_CHARS) return json({ error: "text_must_be_1_to_800_chars" }, 400);
    const download = await supabaseFetch(env, token, "storage/v1/object/authenticated/personal-voice-samples/" + profile.sample_object_key.split("/").map(encodeURIComponent).join("/"));
    if (!download.ok) return json({ error: "voice_sample_not_found" }, 410);
    const decrypted = await decryptSample(await download.arrayBuffer(), env);
    const form = new FormData();
    form.append("text", text);
    form.append("reference_text", profile.reference_text || "");
    form.append("reference_audio", new Blob([decrypted], { type: profile.sample_mime_type || "audio/wav" }), "reference-audio");
    let response;
    try {
      response = await fetch(new URL("/synthesize", inferenceUrl), {
        method: "POST", headers: { authorization: "Bearer " + inferenceToken }, body: form,
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
    const patch = {
      name, consent_voice_use: voiceUse, consent_sample_storage: sampleStorage, consent_model_training: training,
      status: voiceUse && sampleStorage && profile.sample_object_key ? "active" : "revoked"
    };
    if (!sampleStorage) {
      if (profile.sample_object_key) await removeStoredSample(env, token, profile.sample_object_key);
      Object.assign(patch, { sample_object_key: null, sample_mime_type: null, sample_bytes: null, reference_text: null });
    }
    const response = await supabaseFetch(env, token, "rest/v1/personal_voice_profiles?id=eq." + profileId + "&owner_id=eq." + user.id, {
      method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify(patch)
    });
    if (!response.ok) return json({ error: "voice_profile_update_failed" }, 502);
    if (!voiceUse || !sampleStorage) {
      await supabaseFetch(env, token, "rest/v1/personal_voice_preferences?owner_id=eq." + user.id + "&default_profile_id=eq." + profileId, {
        method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ default_profile_id: null })
      });
    }
    const rows = await readJson(response);
    return json({ profile: asProfile(rows?.[0]) });
  }

  if (action === "" && request.method === "DELETE") {
    if (profile.sample_object_key) await removeStoredSample(env, token, profile.sample_object_key);
    await supabaseFetch(env, token, "rest/v1/personal_voice_preferences?owner_id=eq." + user.id + "&default_profile_id=eq." + profileId, {
      method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ default_profile_id: null })
    });
    const response = await supabaseFetch(env, token, "rest/v1/personal_voice_profiles?id=eq." + profileId + "&owner_id=eq." + user.id, { method: "DELETE" });
    if (!response.ok) return json({ error: "voice_profile_delete_failed" }, 502);
    return json({ ok: true, serial_retained: true });
  }
  return json({ error: "method_not_allowed" }, 405);
}

async function catalogRoute(request, env, auth, url) {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const query = new URLSearchParams({
    select: "id,display_name,language,style,provider_id,provider_voice_id,preview_url,license_status,consent_status",
    enabled: "eq.true", order: "display_name.asc", limit: "50"
  });
  const q = String(url.searchParams.get("q") || "").trim().slice(0, 80);
  const language = String(url.searchParams.get("language") || "").trim().slice(0, 16);
  const style = String(url.searchParams.get("style") || "").trim().slice(0, 32);
  if (q) query.set("or", "(display_name.ilike.*" + q.replace(/[(),]/g, "") + "*,provider_voice_id.ilike.*" + q.replace(/[(),]/g, "") + "*)");
  if (language) query.set("language", "eq." + language);
  if (style) query.set("style", "eq." + style);
  const response = await supabaseFetch(env, auth.token, "rest/v1/personal_voice_catalog?" + query);
  if (!response.ok) return json({ error: "voice_catalog_unavailable" }, 502);
  const rows = await readJson(response);
  return json({ voices: (rows || []).map(row => ({ ...row, available: providerAvailability(env, row.provider_id) })) });
}

export async function handlePersonalVoiceRequest(request, env = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/personal-voice/")) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method === "GET" && url.pathname === "/personal-voice/health") {
    const inference = (() => { try { const value = new URL(String(env.PERSONAL_VOICE_API_URL || "")); return value.protocol === "https:" && !!env.PERSONAL_VOICE_API_TOKEN; } catch { return false; } })();
    return json({
      ok: true,
      enabled: !!baseUrl(env) && !!publishableKey(env) && !!encryptionKey(env),
      auth_configured: !!baseUrl(env) && !!publishableKey(env),
      encrypted_storage_configured: !!baseUrl(env) && !!publishableKey(env) && !!encryptionKey(env),
      inference_configured: inference,
      owner_verification: "asm_is_registered_owner"
    });
  }
  const auth = await authenticatedUser(request, env);
  if (!auth) return json({ error: "registered_owner_authentication_required" }, 401);
  try {
    if (url.pathname === "/personal-voice/catalog") return await catalogRoute(request, env, auth, url);
    if (url.pathname.startsWith("/personal-voice/profiles") || url.pathname.startsWith("/personal-voice/catalog/saved") || url.pathname === "/personal-voice/preferences/default") {
      return await profilesRoute(request, env, auth, url);
    }
    return json({ error: "personal_voice_route_not_found" }, 404);
  } catch (error) {
    const code = String(error?.message || "");
    if (code === "voice_encryption_not_configured") return json({ error: code }, 503);
    return json({ error: "personal_voice_request_failed" }, 500);
  }
}

export const PERSONAL_VOICE_LIMITS = Object.freeze({
  sampleBytes: MAX_SAMPLE_BYTES,
  synthesisTextChars: MAX_TEXT_CHARS,
  referenceTextChars: MAX_REFERENCE_TEXT_CHARS
});
