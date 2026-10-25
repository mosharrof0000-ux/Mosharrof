const MAX_UPLOAD_BYTES = 39 * 1024 * 1024;
const MAX_REQUEST_BYTES = 40 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function apiBase(env) {
  try {
    const value = String(env.VIDEO_CUTTING_API_URL || "").trim();
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    ) return null;
    return url;
  } catch {
    return null;
  }
}

function configured(env) {
  return String(env.VIDEO_CUTTING_ENABLED || "").toLowerCase() === "true" &&
    !!apiBase(env) &&
    String(env.VIDEO_CUTTING_API_TOKEN || "").length >= 32 &&
    String(env.VIDEO_CUTTING_ACCESS_TOKEN || "").length >= 32;
}

function constantTimeEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function authorized(request, env) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer ([\x21-\x7e]{32,4096})$/);
  return !!match && constantTimeEqual(match[1], env.VIDEO_CUTTING_ACCESS_TOKEN);
}

function cappedBody(body, maxBytes) {
  if (!body) throw new Error("video_upload_body_missing");
  let total = 0;
  return body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maxBytes) {
        controller.error(new Error("video_upload_too_large"));
        return;
      }
      controller.enqueue(chunk);
    }
  }));
}

function safeUpstreamResponse(upstream, { output = false } = {}) {
  const headers = new Headers({
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  else headers.set("content-type", output && upstream.ok ? "video/mp4" : "application/json; charset=utf-8");
  if (output && upstream.ok) {
    headers.set("content-type", "video/mp4");
    headers.set("content-disposition", 'attachment; filename="mosharrof-edited.mp4"');
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

async function callApi(request, env, path, { upload = false, output = false } = {}) {
  const base = apiBase(env);
  const url = new URL(path, base);
  const headers = new Headers({
    authorization: "Bearer " + env.VIDEO_CUTTING_API_TOKEN,
    accept: output ? "video/mp4, application/json" : "application/json"
  });
  let body;
  if (upload) {
    const contentType = request.headers.get("content-type") || "";
    if (!/^multipart\/form-data\s*;\s*boundary=/i.test(contentType)) {
      return json({ error: "multipart_video_upload_required" }, 415);
    }
    const lengthHeader = request.headers.get("content-length");
    if (lengthHeader !== null) {
      if (!/^\d+$/.test(lengthHeader)) return json({ error: "invalid_content_length" }, 400);
      if (Number(lengthHeader) > MAX_REQUEST_BYTES) return json({ error: "video_upload_too_large", max_upload_bytes: MAX_UPLOAD_BYTES }, 413);
    }
    headers.set("content-type", contentType);
    try {
      body = cappedBody(request.body, MAX_REQUEST_BYTES);
    } catch {
      return json({ error: "video_upload_body_missing" }, 400);
    }
  }
  try {
    const upstream = await fetch(url, {
      method: upload ? "POST" : "GET",
      headers,
      ...(upload ? { body } : {}),
      signal: AbortSignal.timeout(upload || output ? 120000 : 15000)
    });
    return safeUpstreamResponse(upstream, { output });
  } catch (error) {
    if (String(error && error.message || "").includes("video_upload_too_large")) {
      return json({ error: "video_upload_too_large", max_upload_bytes: MAX_UPLOAD_BYTES }, 413);
    }
    if (error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return json({ error: "video_cutting_upstream_timeout" }, 504);
    }
    return json({ error: "video_cutting_upstream_unavailable" }, 502);
  }
}

/**
 * A disabled-by-default, server-to-server proxy for small authorized test clips.
 * Large uploads require a separate direct-upload design and are intentionally rejected by this route.
 */
export async function handleVideoCuttingProxy(request, env = {}) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/video-cut/")) return null;

  if (path === "/video-cut/health" && request.method === "GET") {
    return json({
      ok: true,
      enabled: configured(env),
      authentication_required: true,
      max_upload_bytes: MAX_UPLOAD_BYTES,
      large_uploads_supported: false
    });
  }

  if (!configured(env)) return json({ error: "video_cutting_not_configured" }, 503);
  if (!authorized(request, env)) return json({ error: "video_cutting_access_denied" }, 401);

  if (path === "/video-cut/upload") {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    return callApi(request, env, "/api/v1/uploads", { upload: true });
  }

  const match = path.match(/^\/video-cut\/jobs\/([^/]+)(\/output)?$/);
  if (match) {
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
    if (!UUID_PATTERN.test(match[1])) return json({ error: "invalid_job_id" }, 400);
    const suffix = match[2] ? "/output" : "";
    return callApi(request, env, "/api/v1/jobs/" + match[1] + suffix, { output: !!match[2] });
  }

  return json({ error: "video_cutting_route_not_found" }, 404);
}

export const VIDEO_CUTTING_MAX_UPLOAD_BYTES = MAX_UPLOAD_BYTES;
