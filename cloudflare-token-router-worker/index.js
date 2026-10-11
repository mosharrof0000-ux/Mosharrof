const API_BASE = "https://api.cloudflare.com/client/v4";
const BUILD_ID = "2026-10-11-token-router-worker-v1";
const MAX_BODY_BYTES = 4096;
const MAX_RESPONSE_BYTES = 1024 * 1024;

const OPERATIONS = Object.freeze({
  "zone.read": {
    method: "GET",
    permissions: ["Zone Read"],
    buildPath: (input) => {
      const id = safeId(input.zone_id);
      return id ? { path: "/zones/" + id, scope: "/zones/" + id } : null;
    },
  },
  "worker.scripts.list": {
    method: "GET",
    permissions: ["Workers Scripts Read"],
    buildPath: (input) => {
      const id = safeId(input.account_id);
      return id ? { path: "/accounts/" + id + "/workers/scripts", scope: "/accounts/" + id + "/workers/scripts" } : null;
    },
  },
});

function safeId(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) return null;
  return /^[A-Za-z0-9._~-]+$/.test(value) && value !== "." && value !== ".." ? value : null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (x) => x.toString(16).padStart(2, "0")).join("");
}

async function authorized(request, env) {
  const expected = String(env.ROUTER_ACCESS_TOKEN || "");
  const header = request.headers.get("Authorization") || "";
  if (!expected || !header.startsWith("Bearer ")) return false;
  const supplied = header.slice(7);
  if (!supplied || supplied.length > 4096) return false;
  return (await digest(supplied)) === (await digest(expected));
}

function parseProfiles(env) {
  let profiles;
  try { profiles = JSON.parse(String(env.CLOUDFLARE_TOKEN_PROFILES || "[]")); }
  catch { throw new Error("TOKEN_PROFILE_CONFIG_INVALID"); }
  if (!Array.isArray(profiles)) throw new Error("TOKEN_PROFILE_CONFIG_INVALID");
  const seen = new Set();
  return profiles.map((p) => {
    if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("TOKEN_PROFILE_CONFIG_INVALID");
    const id = String(p.token_id || "");
    const binding = String(p.secret_binding || "");
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || seen.has(id)) throw new Error("TOKEN_PROFILE_CONFIG_INVALID");
    if (!/^[A-Z][A-Z0-9_]{2,127}$/.test(binding)) throw new Error("TOKEN_PROFILE_CONFIG_INVALID");
    if (!Array.isArray(p.permissions) || !p.permissions.length || !p.permissions.every((x) => typeof x === "string" && x.length > 0)) throw new Error("TOKEN_PROFILE_CONFIG_INVALID");
    if (!Array.isArray(p.resource_scopes) || !p.resource_scopes.length || !p.resource_scopes.every((x) =>
      typeof x === "string" &&
      /^\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/.test(x) &&
      !x.split("/").some((segment) => segment === "." || segment === "..")
    )) throw new Error("TOKEN_PROFILE_CONFIG_INVALID");
    seen.add(id);
    return { token_id: id, secret_binding: binding, permissions: new Set(p.permissions), resource_scopes: p.resource_scopes, enabled: p.enabled === true };
  });
}

function covers(allowed, requested) {
  const a = allowed.replace(/\/+$/, "");
  const r = requested.replace(/\/+$/, "");
  if (!a || !r) return false;
  return r === a || r.startsWith(a + "/");
}

function selectToken(profiles, env, permissions, scope) {
  const candidates = [];
  for (const p of profiles) {
    if (!p.enabled || !permissions.every((x) => p.permissions.has(x))) continue;
    if (!p.resource_scopes.some((x) => covers(x, scope))) continue;
    const token = String(env[p.secret_binding] || "").trim();
    if (!token) continue;
    candidates.push({ p, token, extraPermissions: p.permissions.size - permissions.length });
  }
  const specificity = (profile) => Math.max(0, ...profile.resource_scopes
    .filter((s) => covers(s, scope))
    .map((s) => s.replace(/\\/+$/, "").length));
  candidates.sort((a, b) =>
    a.extraPermissions - b.extraPermissions ||
    specificity(b.p) - specificity(a.p) ||
    a.p.token_id.localeCompare(b.p.token_id)
  );
  return candidates[0] || null;
}

async function readLimited(response, maxBytes) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("response_limit_exceeded").catch(() => {});
        throw new Error("CLOUDFLARE_RESPONSE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(merged);
}

async function cloudflareRequest(method, path, token) {
  const response = await fetch(API_BASE + path, {
    method,
    headers: { Authorization: "Bearer " + token, Accept: "application/json", "User-Agent": "MOSHARROF-Token-Router/1" },
    redirect: "error",
  });
  if (response.status === 401 || response.status === 403) {
    return { ok: false, status: response.status, error: "CLOUDFLARE_AUTHORIZATION_DENIED" };
  }
  if (!response.ok) return { ok: false, status: response.status, error: "CLOUDFLARE_API_ERROR" };
  let raw;
  try { raw = await readLimited(response, MAX_RESPONSE_BYTES); }
  catch (error) {
    return { ok: false, status: 502, error: error.message === "CLOUDFLARE_RESPONSE_TOO_LARGE" ? error.message : "CLOUDFLARE_RESPONSE_READ_FAILED" };
  }
  let payload;
  try { payload = JSON.parse(raw); } catch { return { ok: false, status: 502, error: "CLOUDFLARE_INVALID_JSON" }; }
  if (!payload || typeof payload !== "object" || payload.success === false) return { ok: false, status: 502, error: "CLOUDFLARE_OPERATION_FAILED" };
  return { ok: true, status: response.status, payload };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "mosharrof-cloudflare-token-router", build: BUILD_ID, mode: "read-only", access_configured: !!env.ROUTER_ACCESS_TOKEN, profiles_configured: !!env.CLOUDFLARE_TOKEN_PROFILES });
    }
    if (request.method !== "POST" || url.pathname !== "/v1/operation") return json({ error: "NOT_FOUND" }, 404);
    if (!(await authorized(request, env))) return json({ error: "UNAUTHORIZED" }, 401);

    const length = Number(request.headers.get("content-length") || 0);
    if (length > MAX_BODY_BYTES) return json({ error: "REQUEST_TOO_LARGE" }, 413);
    let input;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) return json({ error: "REQUEST_TOO_LARGE" }, 413);
      input = JSON.parse(raw);
    } catch { return json({ error: "INVALID_JSON" }, 400); }
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((k) => !["operation", "zone_id", "account_id"].includes(k))) {
      return json({ error: "INVALID_REQUEST_FIELDS" }, 400);
    }
    const operation = OPERATIONS[String(input.operation || "")];
    if (!operation) return json({ error: "OPERATION_NOT_ALLOWED" }, 403);
    const target = operation.buildPath(input);
    if (!target) return json({ error: "INVALID_RESOURCE_ID" }, 400);

    let profiles;
    try { profiles = parseProfiles(env); } catch { return json({ error: "TOKEN_PROFILE_CONFIG_INVALID" }, 503); }
    const selected = selectToken(profiles, env, operation.permissions, target.scope);
    if (!selected) return json({ error: "NO_ENABLED_TOKEN_COVERS_REQUEST" }, 403);

    try {
      const result = await cloudflareRequest(operation.method, target.path, selected.token);
      const audit = { operation: input.operation, token_id: selected.p.token_id, permissions: operation.permissions, resource_scope: target.scope, outcome: result.ok ? "success" : "failure", http_status: result.status };
      if (!result.ok) return json({ error: result.error, audit }, result.status === 401 || result.status === 403 ? 502 : result.status);
      return json({ ok: true, result: result.payload.result ?? null, audit }, 200);
    } catch {
      return json({ error: "CLOUDFLARE_NETWORK_ERROR", audit: { operation: input.operation, resource_scope: target.scope, outcome: "network_error" } }, 502);
    }
  },
};

export { covers, parseProfiles, safeId, selectToken, OPERATIONS };
