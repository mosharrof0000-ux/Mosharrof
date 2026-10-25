import chatWorker from "../../worker/screenshot-analysis.js";
import { handleVideoCuttingProxy } from "./worker-proxy.js";

const TRUSTED_APP_ORIGINS = new Set([
  "https://mosharrof0000-ux.github.io",
  "http://localhost",
  "https://localhost",
  "http://127.0.0.1",
  "https://127.0.0.1",
  "capacitor://localhost",
  "ionic://localhost",
  "https://appassets.androidplatform.net"
]);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (TRUSTED_APP_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

function withVideoCors(response, request) {
  const origin = request.headers.get("Origin") || "";
  const headers = new Headers(response.headers);
  if (origin && isAllowedOrigin(origin)) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "content-type,authorization");
  headers.set("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/video-cut/")) {
      return chatWorker.fetch(request, env, ctx);
    }

    const origin = request.headers.get("Origin") || "";
    if (!isAllowedOrigin(origin)) return jsonError("origin_not_allowed", 403);
    if (request.method === "OPTIONS") {
      return withVideoCors(new Response(null, { status: 204 }), request);
    }

    try {
      const response = await handleVideoCuttingProxy(request, env);
      return withVideoCors(response || jsonError("video_cutting_route_not_found", 404), request);
    } catch {
      return withVideoCors(jsonError("video_cutting_proxy_failed", 502), request);
    }
  }
};
