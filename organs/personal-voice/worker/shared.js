export const MAX_SAMPLE_BYTES = 5 * 1024 * 1024;
export const MAX_TEXT_CHARS = 800;
export const MAX_REFERENCE_TEXT_CHARS = 500;
export const AUDIO_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave", "audio/flac", "audio/ogg"]);
export const PROFILE_FIELDS = "id,owner_id,voice_serial,name,language,provider_id,status,consent_voice_use,consent_sample_storage,consent_model_training,sample_object_key,previous_sample_object_key,sample_mime_type,sample_bytes,reference_text,created_at,updated_at";
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
  });
}

export function baseUrl(env) {
  try {
    const url = new URL(String(env.SUPABASE_URL || "").trim());
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return url;
  } catch { return null; }
}

export function publishableKey(env) {
  return String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "").trim();
}

export async function supabaseFetch(env, token, path, options = {}) {
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

export async function authenticatedUser(request, env) {
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

export function asProfile(row) {
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

export function encryptionKey(env) {
  const raw = String(env.PERSONAL_VOICE_ENCRYPTION_KEY || "").trim();
  if (!raw) return null;
  try {
    const bytes = Uint8Array.from(atob(raw), char => char.charCodeAt(0));
    return bytes.length === 32 ? bytes : null;
  } catch { return null; }
}

export async function encryptSample(raw, env) {
  const bytes = encryptionKey(env);
  if (!bytes) throw new Error("voice_encryption_not_configured");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt"]);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, raw));
  const packed = new Uint8Array(1 + iv.length + encrypted.length);
  packed[0] = 1;
  packed.set(iv, 1);
  packed.set(encrypted, 1 + iv.length);
  return packed;
}

export async function decryptSample(packed, env) {
  const bytes = encryptionKey(env);
  if (!bytes || packed.byteLength < 29) throw new Error("voice_sample_unavailable");
  const data = new Uint8Array(packed);
  if (data[0] !== 1) throw new Error("voice_sample_version_unsupported");
  const key = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["decrypt"]);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: data.slice(1, 13) }, key, data.slice(13)));
  } catch {
    throw new Error("voice_sample_authentication_failed");
  }
}

export async function readJson(response) {
  return response.json().catch(() => null);
}

export async function getProfile(env, token, ownerId, id) {
  const query = new URLSearchParams({ select: PROFILE_FIELDS, id: "eq." + id, owner_id: "eq." + ownerId, limit: "1" });
  const response = await supabaseFetch(env, token, "rest/v1/personal_voice_profiles?" + query);
  if (!response.ok) throw new Error("profile_lookup_failed");
  const rows = await readJson(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

export async function removeStoredSample(env, token, key) {
  if (!key) return;
  const response = await supabaseFetch(env, token, "storage/v1/object/personal-voice-samples", {
    method: "DELETE",
    body: JSON.stringify({ prefixes: [key] })
  });
  if (!response.ok && response.status !== 404) throw new Error("sample_delete_failed");
}

export function providerAvailability(env, provider) {
  if (provider === "edge") return !!env.EDGE_TTS_API_URL;
  if (provider === "azure") return !!env.AZURE_SPEECH_KEY && !!env.AZURE_SPEECH_REGION;
  if (provider === "gemini") return !!(env.GEMINI_API_KEY || env.GEMINI_API_KEY_2 || env.GEMINI_API_KEY_3 || env.GEMINI_API_KEY_4 || env.GEMINI_API_KEY_5);
  if (provider === "sarvam") return !!env.SARVAM_API_KEY;
  if (provider === "elevenlabs") return !!env.ELEVENLABS_API_KEY;
  return false;
}

