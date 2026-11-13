import { encryptionKey, json, supabaseFetch } from "./shared.js";

export async function getPersonalVoiceReadiness(env, auth) {
  const { user, token } = auth;
  let databaseReady = false;
  let storageReady = false;
  try {
    const response = await supabaseFetch(env, token, "rest/v1/personal_voice_profiles?select=id&limit=0");
    databaseReady = response.ok;
  } catch {}
  try {
    const response = await supabaseFetch(env, token, "storage/v1/object/list/personal-voice-samples", {
      method: "POST",
      body: JSON.stringify({ prefix: user.id, limit: 1, offset: 0 })
    });
    storageReady = response.ok;
  } catch {}
  const encryptionReady = !!encryptionKey(env);
  let inferenceReady = false;
  try {
    const endpoint = new URL(String(env.PERSONAL_VOICE_API_URL || ""));
    if (endpoint.protocol === "https:" && !endpoint.username && !endpoint.password && String(env.PERSONAL_VOICE_API_TOKEN || "").trim()) {
      const response = await fetch(new URL("/ready", endpoint), {
        headers: { authorization: "Bearer " + String(env.PERSONAL_VOICE_API_TOKEN || "").trim() },
        signal: AbortSignal.timeout(120000), cache: "no-store"
      });
      const health = await response.json().catch(() => ({}));
      inferenceReady = response.ok && health.ready === true && health.model_loaded === true;
    }
  } catch {}
  return json({
    ready: databaseReady && storageReady && encryptionReady && inferenceReady,
    database_ready: databaseReady,
    private_storage_ready: storageReady,
    encryption_ready: encryptionReady,
    inference_ready: inferenceReady,
    owner_verified: true
  });
}
