import {
  MAX_SAMPLE_BYTES, MAX_TEXT_CHARS, MAX_REFERENCE_TEXT_CHARS, json, baseUrl, publishableKey,
  encryptionKey, authenticatedUser
} from "./shared.js";
import { profilesRoute } from "./profiles.js";
import { catalogRoute } from "./catalog.js";
import { handlePersonalVoiceAuth } from "./auth.js";
import { getPersonalVoiceReadiness } from "./readiness.js";

export async function handlePersonalVoiceRequest(request, env = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/personal-voice/")) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (url.pathname === "/personal-voice/auth/login" || url.pathname === "/personal-voice/auth/refresh") {
    return handlePersonalVoiceAuth(request, env);
  }
  if (request.method === "GET" && url.pathname === "/personal-voice/health") {
    const inference = (() => { try { const value = new URL(String(env.PERSONAL_VOICE_API_URL || "")); return value.protocol === "https:" && !!env.PERSONAL_VOICE_API_TOKEN; } catch { return false; } })();
    return json({
      ok: true,
      enabled: !!baseUrl(env) && !!publishableKey(env) && !!encryptionKey(env) && inference,
      auth_configured: !!baseUrl(env) && !!publishableKey(env),
      encrypted_storage_configured: !!baseUrl(env) && !!publishableKey(env) && !!encryptionKey(env),
      inference_configured: inference,
      owner_verification: "asm_is_registered_owner"
    });
  }
  const auth = await authenticatedUser(request, env);
  if (!auth) return json({ error: "registered_owner_authentication_required" }, 401);
  if (request.method === "GET" && url.pathname === "/personal-voice/readiness") return getPersonalVoiceReadiness(env, auth);
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
