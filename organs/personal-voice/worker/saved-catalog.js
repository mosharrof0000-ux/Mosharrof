import { json, supabaseFetch, readJson, providerAvailability, UUID, getProfile } from "./shared.js";

export async function savedCatalogRoute(request, env, auth, url) {
  const { user, token } = auth;
  const path = url.pathname;

  if (path === "/personal-voice/catalog/saved" && request.method === "GET") {
    const query = new URLSearchParams({
      select: "id,voice_serial,nickname,catalog_voice_id,personal_voice_catalog(id,display_name,language,style,provider_id,provider_voice_id,license_status,consent_status,enabled)",
      owner_id: "eq." + user.id, order: "voice_serial.asc"
    });
    const response = await supabaseFetch(env, token, "rest/v1/personal_voice_saved_catalog?" + query);
    if (!response.ok) return json({ error: "saved_voice_list_failed" }, 502);
    const rows = await readJson(response);
    return json({ voices: (rows || []).map(row => {
      const voice = row.personal_voice_catalog || {};
      const provider_available = providerAvailability(env, voice.provider_id);
      const license_verified = voice.license_status === "verified";
      const consent_documented = voice.consent_status === "documented";
      return {
        id: row.id,
        serial: "VOICE-" + String(row.voice_serial).padStart(3, "0"),
        nickname: row.nickname,
        catalog_voice_id: row.catalog_voice_id,
        voice: {
          ...voice, provider_available, license_verified, consent_documented,
          available: voice.enabled === true && provider_available && license_verified && consent_documented
        }
      };
    }) });
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

  const savedDelete = path.match(/^\\/personal-voice\\/catalog\\/saved\\/([0-9a-f-]{36})$/i);
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
    if (!profile || profile.status !== "active" || !profile.sample_object_key || !profile.consent_voice_use || !profile.consent_sample_storage) {
      return json({ error: "active_owned_voice_profile_required" }, 404);
    }
    const response = await supabaseFetch(env, token, "rest/v1/personal_voice_preferences?on_conflict=owner_id", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ owner_id: user.id, default_profile_id: profileId })
    });
    if (!response.ok) return json({ error: "default_voice_update_failed" }, 502);
    return json({ ok: true, default_profile_id: profileId });
  }

  return json({ error: "personal_voice_route_not_found" }, 404);
}
