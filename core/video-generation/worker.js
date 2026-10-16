const BUILD_ID = "2026-10-16-video-v1";
const MODEL = "fal-ai/wan/v2.7/text-to-video";
const QUEUE_BASE = "https://queue.fal.run/" + MODEL;
const TRUSTED_ORIGINS = new Set([
  "https://mosharrof0000-ux.github.io",
  "http://localhost", "https://localhost",
  "http://127.0.0.1", "https://127.0.0.1",
  "capacitor://localhost", "ionic://localhost",
  "https://appassets.androidplatform.net"
]);
const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "vary": "Origin" };
const submitTimes = new Map();
const statusTimes = new Map();

function json(data, status, origin = "") {
  const headers = { ...HEADERS };
  if (origin && TRUSTED_ORIGINS.has(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
    headers["access-control-allow-headers"] = "content-type";
  }
  return new Response(JSON.stringify(data), { status, headers });
}
function ipFor(request) {
  return String(request.headers.get("CF-Connecting-IP") || "unknown").slice(0, 80);
}
function allowRate(map, key, limit, windowMs, now = Date.now()) {
  const recent = (map.get(key) || []).filter(t => now - t < windowMs);
  if (recent.length >= limit) { map.set(key, recent); return false; }
  recent.push(now);
  map.set(key, recent);
  if (map.size > 10000) {
    for (const [k, values] of map) {
      if (!values.length || now - values[values.length - 1] >= windowMs) map.delete(k);
      if (map.size <= 8000) break;
    }
  }
  return true;
}
function enabled(env) {
  return String(env.VIDEO_GENERATION_ENABLED || "").trim().toLowerCase() === "true";
}
function configured(env) {
  return Boolean(String(env.FAL_KEY || "").trim());
}
function disabledReply(env, origin) {
  if (!enabled(env)) return json({
    ok: false, error: "video_generation_disabled",
    message: "ভিডিও তৈরি এখনো নিরাপত্তার কারণে বন্ধ আছে। সার্ভারে স্পষ্টভাবে চালু করতে হবে।"
  }, 503, origin);
  if (!configured(env)) return json({
    ok: false, error: "video_provider_not_configured",
    message: "ভিডিও তৈরি চালু করতে সার্ভারে FAL_KEY নিরাপদে কনফিগার করতে হবে।"
  }, 503, origin);
  return null;
}
async function parseJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 16000) return null;
  try { return await request.json(); } catch { return null; }
}
async function generateVideo(request, env, origin) {
  const blocked = disabledReply(env, origin);
  if (blocked) return blocked;
  if (!origin || !TRUSTED_ORIGINS.has(origin)) return json({ ok: false, error: "trusted_origin_required" }, 403, origin);
  const body = await parseJson(request);
  if (!body || typeof body !== "object") return json({ ok: false, error: "invalid_json" }, 400, origin);
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return json({ ok: false, error: "prompt_required" }, 400, origin);
  if (prompt.length > 5000) return json({ ok: false, error: "prompt_too_long", max_length: 5000 }, 413, origin);
  const aspect = ["16:9", "9:16", "1:1", "4:3", "3:4"].includes(body.aspect_ratio) ? body.aspect_ratio : "16:9";
  const ip = ipFor(request);
  // Additional in-memory guard only; paid generation remains disabled until a durable edge limit is configured.
  if (!allowRate(submitTimes, ip, 2, 60 * 60 * 1000)) {
    return json({ ok: false, error: "video_rate_limited", retry_after_seconds: 3600 }, 429, origin);
  }
  const payload = { prompt, aspect_ratio: aspect, resolution: "720p", duration: 10, enable_prompt_expansion: true, enable_safety_checker: true };
  try {
    const upstream = await fetch(QUEUE_BASE, {
      method: "POST",
      headers: { "Authorization": "Key " + String(env.FAL_KEY).trim(), "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const code = upstream.status === 401 || upstream.status === 403 ? "video_provider_auth_failed"
        : upstream.status === 402 ? "video_provider_credit_required"
        : upstream.status === 429 ? "video_provider_rate_limited" : "video_submit_failed";
      return json({
        ok: false, error: code, status: upstream.status,
        message: "ভিডিও তৈরির অনুরোধ গ্রহণ করা যায়নি। Provider key, credit ও status যাচাই করুন।"
      }, upstream.status === 429 ? 429 : upstream.status === 402 ? 402 : 502, origin);
    }
    const id = String(data.request_id || "");
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) return json({ ok: false, error: "video_request_id_missing" }, 502, origin);
    return json({ ok: true, request_id: id, status: "IN_QUEUE", model: MODEL, duration: 10, aspect_ratio: aspect }, 202, origin);
  } catch {
    return json({ ok: false, error: "video_provider_unreachable" }, 502, origin);
  }
}
async function videoStatus(request, env, origin) {
  const blocked = disabledReply(env, origin);
  if (blocked) return blocked;
  if (!origin || !TRUSTED_ORIGINS.has(origin)) return json({ ok: false, error: "trusted_origin_required" }, 403, origin);
  const body = await parseJson(request);
  if (!body || typeof body !== "object") return json({ ok: false, error: "invalid_json" }, 400, origin);
  const id = typeof body.request_id === "string" ? body.request_id : "";
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) return json({ ok: false, error: "invalid_video_request_id" }, 400, origin);
  if (!allowRate(statusTimes, ipFor(request), 120, 60 * 60 * 1000)) return json({ ok: false, error: "video_status_rate_limited" }, 429, origin);
  const url = QUEUE_BASE + "/requests/" + encodeURIComponent(id);
  try {
    const statusResponse = await fetch(url + "/status", {
      headers: { "Authorization": "Key " + String(env.FAL_KEY).trim(), "Accept": "application/json" }
    });
    const statusData = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) return json({ ok: false, error: "video_status_unavailable" }, 502, origin);
    const status = String(statusData.status || "UNKNOWN");
    if (status === "FAILED" || status === "CANCELLED") return json({ ok: false, error: "video_generation_failed", status }, 502, origin);
    if (status !== "COMPLETED") return json({
      ok: true, status,
      logs: Array.isArray(statusData.logs) ? statusData.logs.slice(-3).map(x => String(x.message || "").slice(0, 180)) : []
    }, 200, origin);
    const resultResponse = await fetch(url, {
      headers: { "Authorization": "Key " + String(env.FAL_KEY).trim(), "Accept": "application/json" }
    });
    const resultData = await resultResponse.json().catch(() => ({}));
    if (!resultResponse.ok) return json({ ok: false, error: "video_result_unavailable" }, 502, origin);
    const video = resultData.video || resultData.output?.video || null;
    const videoUrl = video && typeof video.url === "string" ? video.url : "";
    if (!videoUrl) return json({ ok: false, error: "video_output_missing" }, 502, origin);
    let parsed;
    try { parsed = new URL(videoUrl); } catch { return json({ ok: false, error: "video_output_invalid" }, 502, origin); }
    if (parsed.protocol !== "https:" || !(parsed.hostname === "fal.media" || parsed.hostname.endsWith(".fal.media") || parsed.hostname === "fal.ai" || parsed.hostname.endsWith(".fal.ai"))) {
      return json({ ok: false, error: "video_output_host_rejected" }, 502, origin);
    }
    return json({
      ok: true, status: "COMPLETED", video_url: parsed.toString(),
      content_type: String(video.content_type || "video/mp4").slice(0, 100),
      file_name: String(video.file_name || "mosharrof-video.mp4").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100),
      duration: Number(video.duration) || 10, model: MODEL,
      actual_prompt: typeof resultData.actual_prompt === "string" ? resultData.actual_prompt.slice(0, 1000) : undefined
    }, 200, origin);
  } catch {
    return json({ ok: false, error: "video_status_unreachable" }, 502, origin);
  }
}
async function handleRequest(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (origin && !TRUSTED_ORIGINS.has(origin)) return json({ ok: false, error: "origin_not_allowed" }, 403);
  if (request.method === "OPTIONS") return json({ ok: true }, 200, origin);
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") return json({
    ok: true, service: "mosharrof-video-generation", build_id: BUILD_ID,
    model: MODEL, enabled: enabled(env), provider_configured: configured(env), duration_seconds: 10
  }, 200, origin);
  if (request.method === "POST" && url.pathname === "/generate-video") return generateVideo(request, env, origin);
  if (request.method === "POST" && url.pathname === "/video-status") return videoStatus(request, env, origin);
  return json({ ok: false, error: "not_found" }, 404, origin);
}
export default { fetch: handleRequest };
