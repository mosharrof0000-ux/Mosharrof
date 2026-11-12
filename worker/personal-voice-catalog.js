import { json, supabaseFetch, readJson, providerAvailability } from "./personal-voice-shared.js";

export async function catalogRoute(request, env, auth, url) {
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

