import { removeStoredSample, supabaseFetch } from "./shared.js";

export async function clearPreviousSample(env, token, ownerId, profile) {
  const key = profile?.previous_sample_object_key;
  if (!key) return true;
  try {
    await removeStoredSample(env, token, key);
    const response = await supabaseFetch(env, token,
      "rest/v1/personal_voice_profiles?id=eq." + profile.id + "&owner_id=eq." + ownerId,
      { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ previous_sample_object_key: null }) }
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function removeProfileSamples(env, token, profile) {
  const keys = [...new Set([profile?.sample_object_key, profile?.previous_sample_object_key].filter(Boolean))];
  try {
    await Promise.all(keys.map(key => removeStoredSample(env, token, key)));
    return true;
  } catch {
    return false;
  }
}
