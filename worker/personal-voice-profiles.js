import { createIndicF5Request, synthesizeWithIndicF5 } from "../organs/personal-voice/providers/indicf5.js";
import {
  MAX_SAMPLE_BYTES, MAX_TEXT_CHARS, MAX_REFERENCE_TEXT_CHARS, AUDIO_TYPES, PROFILE_FIELDS, UUID,
  json, supabaseFetch, asProfile, encryptionKey, encryptSample, decryptSample, readJson,
  getProfile, removeStoredSample
} from "./personal-voice-shared.js";

export async function profilesRoute(request, env, auth, url) {
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
    if (profile.sample_object_key) {
      try { await removeStoredSample(env, token, profile.sample_object_key); }
      catch { return json({ profile: asProfile(rows?.[0]), old_sample_cleanup_pending: true }, 202); }
    }
    return json({ profile: asProfile(rows?.[0]) });
  }

  if (action === "synthesize" && request.method === "POST") {
    if (profile.status !== "active" || !profile.sample_object_key || !profile.consent_voice_use || !profile.consent_sample_storage) return json({ error: "active_consented_voice_profile_required" }, 409);
    if (!encryptionKey(env)) return json({ error: "voice_encryption_not_configured" }, 503);
    const inferenceUrl = String(env.PERSONAL_VOICE_API_URL || "").trim();
    const inferenceToken = String(env.PERSONAL_VOICE_API_TOKEN || "").trim();
    if (!inferenceUrl || !inferenceToken) return json({ error: "personal_voice_inference_not_configured" }, 503);
    const body = await request.json().catch(() => null);
    const text = String(body?.text || "").trim();
    if (!text || text.length > MAX_TEXT_CHARS) return json({ error: "text_must_be_1_to_800_chars" }, 400);
    const quotaResponse = await supabaseFetch(env, token, "rest/v1/rpc/personal_voice_consume_synthesis_quota", {
      method: "POST", body: "{}"
    });
    if (!quotaResponse.ok) return json({ error: "personal_voice_quota_check_unavailable" }, 503);
    const quotaAllowed = await readJson(quotaResponse);
    if (quotaAllowed !== true) return json({ error: "personal_voice_rate_limit_exceeded", retry_after_seconds: 60 }, 429);
    const download = await supabaseFetch(env, token, "storage/v1/object/authenticated/personal-voice-samples/" + profile.sample_object_key.split("/").map(encodeURIComponent).join("/"));
    if (!download.ok) return json({ error: "voice_sample_not_found" }, 410);
    const decrypted = await decryptSample(await download.arrayBuffer(), env);
    let synthesis;
    try {
      const form = createIndicF5Request({
        text, referenceText: profile.reference_text || "",
        audioBytes: decrypted, mimeType: profile.sample_mime_type || "audio/wav"
      });
      synthesis = await synthesizeWithIndicF5({ endpoint: inferenceUrl, token: inferenceToken, formData: form });
    } catch (error) {
      const code = String(error?.message || "");
      if (code.includes("not_configured")) return json({ error: "personal_voice_inference_not_configured" }, 503);
      return json({ error: "personal_voice_inference_failed" }, 502);
    }
    const audio = synthesis.audio;
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
    const sampleKey = profile.sample_object_key;

    // First revoke synthesis so a concurrent request cannot continue using the profile.
    const revoke = await supabaseFetch(env, token, "rest/v1/personal_voice_profiles?id=eq." + profileId + "&owner_id=eq." + user.id, {
      method: "PATCH", headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        name, consent_voice_use: voiceUse, consent_model_training: training,
        status: (!voiceUse || !sampleStorage) ? "revoked" : (sampleKey ? "active" : "draft")
      })
    });
    if (!revoke.ok) return json({ error: "voice_profile_revoke_failed" }, 502);

    if (!sampleStorage && sampleKey) {
      try { await removeStoredSample(env, token, sampleKey); }
      catch { return json({ error: "sample_deletion_pending_profile_revoked" }, 502); }
    }

    const finalPatch = {
      name, consent_voice_use: voiceUse, consent_sample_storage: sampleStorage,
      consent_model_training: training,
      status: voiceUse && sampleStorage && sampleKey ? "active" : "revoked"
    };
    if (!sampleStorage) Object.assign(finalPatch, {
      sample_object_key: null, sample_mime_type: null, sample_bytes: null, reference_text: null
    });
    const response = await supabaseFetch(env, token, "rest/v1/personal_voice_profiles?id=eq." + profileId + "&owner_id=eq." + user.id, {
      method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify(finalPatch)
    });
    if (!response.ok) return json({ error: "voice_profile_update_failed_profile_revoked" }, 502);
    if (!voiceUse || !sampleStorage) {
      await supabaseFetch(env, token, "rest/v1/personal_voice_preferences?owner_id=eq." + user.id + "&default_profile_id=eq." + profileId, {
        method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ default_profile_id: null })
      });
    }
    const rows = await readJson(response);
    return json({ profile: asProfile(rows?.[0]) });
  }

  if (action === "" && request.method === "DELETE") {
    // Revoke first; if storage deletion fails, the still-present revoked row allows a safe retry.
    const revoke = await supabaseFetch(env, token, "rest/v1/personal_voice_profiles?id=eq." + profileId + "&owner_id=eq." + user.id, {
      method: "PATCH", headers: { prefer: "return=minimal" },
      body: JSON.stringify({ status: "revoked", consent_voice_use: false })
    });
    if (!revoke.ok) return json({ error: "voice_profile_revoke_failed" }, 502);
    if (profile.sample_object_key) {
      try { await removeStoredSample(env, token, profile.sample_object_key); }
      catch { return json({ error: "sample_deletion_pending_profile_revoked" }, 502); }
    }
    await supabaseFetch(env, token, "rest/v1/personal_voice_preferences?owner_id=eq." + user.id + "&default_profile_id=eq." + profileId, {
      method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ default_profile_id: null })
    });
    const response = await supabaseFetch(env, token, "rest/v1/personal_voice_profiles?id=eq." + profileId + "&owner_id=eq." + user.id, { method: "DELETE" });
    if (!response.ok) return json({ error: "voice_profile_delete_failed" }, 502);
    return json({ ok: true, serial_retained: true });
  }
  return json({ error: "method_not_allowed" }, 405);
}

