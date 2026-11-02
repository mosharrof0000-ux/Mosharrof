const API_BASE = "https://api.cloudflare.com/client/v4";
const BUILD_ID = "2026-11-02-router-admin-ops-v1";
const MAX_BODY_BYTES = 350000;
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
  "worker.secret.write": {
    method: "PUT", permissions: ["Workers Scripts Write"], privileged: true,
    buildPath: (input) => {
      const account = safeId(input.account_id), script = safeId(input.script_name);
      if (!account || !script || typeof input.secret_name !== "string" || !/^[A-Z][A-Z0-9_]{0,99}$/.test(input.secret_name) || typeof input.secret_value !== "string" || !input.secret_value || input.secret_value.length > 2048) return null;
      return { path: "/accounts/" + account + "/workers/scripts/" + script + "/secrets", scope: "/accounts/" + account + "/workers/scripts/" + script, body: { name: input.secret_name, text: input.secret_value, type: "secret_text" }, sensitive: true };
    },
  },
  "worker.script.deploy": {
    method: "PUT", permissions: ["Workers Scripts Write"], privileged: true,
    buildPath: (input) => {
      const account = safeId(input.account_id), script = safeId(input.script_name);
      if (!account || !script || typeof input.script_content !== "string" || !input.script_content.trim() || input.script_content.length > 300000) return null;
      return { path: "/accounts/" + account + "/workers/scripts/" + script, scope: "/accounts/" + account + "/workers/scripts/" + script, script_content: input.script_content };
    },
  },
  "token.list": {
    method: "GET", permissions: ["API Tokens Read"],
    buildPath: () => ({ path: "/user/tokens", scope: "/user/tokens" }),
  },
  "token.permission_groups.list": {
    method: "GET", permissions: ["API Tokens Read"],
    buildPath: () => ({ path: "/user/tokens/permission_groups", scope: "/user/tokens/permission_groups" }),
  },
  "token.revoke": {
    method: "DELETE", permissions: ["API Tokens Write"], privileged: true,
    buildPath: (input) => {
      const id = safeId(input.token_id);
      return id ? { path: "/user/tokens/" + id, scope: "/user/tokens/" + id } : null;
    },
  },
  "token.create": {
    method: "POST", permissions: ["API Tokens Write"], privileged: true,
    buildPath: (input) => {
      if (typeof input.token_name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9 ._-]{2,119}$/.test(input.token_name) || !Array.isArray(input.policies) || !input.policies.length || input.policies.length > 10) return null;
      const resourceKey = (key) => typeof key === "string" && /^com\.cloudflare\.(api\.(user|account)|edge\.r2\.bucket)(\.[A-Za-z0-9_*.-]+)*$/.test(key) && !/[\r\n]/.test(key);
      const resourceValue = (value) => value === "*" || (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0 && Object.entries(value).every(([key, nested]) => resourceKey(key) && nested === "*"));
      const valid = input.policies.every((p) => p && typeof p === "object" && !Array.isArray(p) && p.effect === "allow" && Array.isArray(p.permission_groups) && p.permission_groups.length > 0 && p.permission_groups.length <= 90 && p.permission_groups.every((g) => g && typeof g.id === "string" && /^[a-f0-9]{32}$/.test(g.id)) && p.resources && typeof p.resources === "object" && !Array.isArray(p.resources) && Object.keys(p.resources).length > 0 && Object.entries(p.resources).every(([key, value]) => resourceKey(key) && resourceValue(value)));
      if (!valid) return null;
      const body = { name: input.token_name, policies: input.policies };
      if (Number.isInteger(input.expires_in)) {
        if (input.expires_in < 1 || input.expires_in > 1440) return null;
        body.expires_on = new Date(Date.now() + input.expires_in * 60000).toISOString();
      } else if (input.expires_in !== undefined) return null;
      return { path: "/user/tokens", scope: "/user/tokens", body };
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
    .map((s) => s.replace(/\/+$/, "").length));
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

async function cloudflareRequest(method, path, token, body, scriptContent) {
  const headers = { Authorization: "Bearer " + token, Accept: "application/json", "User-Agent": "MOSHARROF-Token-Router/1" };
  let requestBody;
  if (typeof scriptContent === "string") {
    const form = new FormData();
    form.set("metadata", new Blob([JSON.stringify({ main_module: "index.js", compatibility_date: "2026-11-02" })], { type: "application/json" }), "metadata.json");
    form.set("index.js", new Blob([scriptContent], { type: "application/javascript+module" }), "index.js");
    requestBody = form;
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    requestBody = JSON.stringify(body);
  }
  const response = await fetch(API_BASE + path, { method, headers, body: requestBody, redirect: "error" });
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
    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/ready")) {
      const accessConfigured = typeof env.ROUTER_ACCESS_TOKEN === "string" && env.ROUTER_ACCESS_TOKEN.trim().length > 0;
      let profiles = [];
      let profileConfigValid = false;
      try {
        profiles = parseProfiles(env);
        profileConfigValid = typeof env.CLOUDFLARE_TOKEN_PROFILES === "string" && env.CLOUDFLARE_TOKEN_PROFILES.trim().length > 0;
      } catch {
        profileConfigValid = false;
      }
      const enabledProfiles = profiles.filter((profile) => profile.enabled);
      const enabledProfilesWithSecret = enabledProfiles.filter((profile) =>
        typeof env[profile.secret_binding] === "string" && env[profile.secret_binding].trim().length > 0
      );
      const ready = accessConfigured && profileConfigValid && enabledProfilesWithSecret.length > 0;
      const payload = {
        ok: url.pathname === "/health" ? true : ready,
        service: "mosharrof-cloudflare-token-router",
        build: BUILD_ID,
        mode: env.PRIVILEGED_OPERATIONS_ENABLED === "true" && !!env.ROUTER_ADMIN_APPROVAL_TOKEN ? "read-write-approval-gated" : "read-only",
        access_configured: accessConfigured,
        profiles_configured: !!env.CLOUDFLARE_TOKEN_PROFILES,
        profile_config_valid: profileConfigValid,
        enabled_profiles_count: enabledProfiles.length,
        enabled_profiles_with_secret_count: enabledProfilesWithSecret.length,
      };
      return json(payload, url.pathname === "/ready" && !ready ? 503 : 200);
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
    const allowedFields = ["operation", "zone_id", "account_id", "script_name", "secret_name", "secret_value", "script_content", "token_name", "token_id", "policies", "expires_in"];
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((k) => !allowedFields.includes(k))) return json({ error: "INVALID_REQUEST_FIELDS" }, 400);
    const operation = OPERATIONS[String(input.operation || "")];
    if (!operation) return json({ error: "OPERATION_NOT_ALLOWED" }, 403);
    if (operation.privileged) {
      if (env.PRIVILEGED_OPERATIONS_ENABLED !== "true") return json({ error: "PRIVILEGED_OPERATIONS_DISABLED" }, 403);
      const approval = request.headers.get("x-router-admin-approval") || "";
      const expectedApproval = String(env.ROUTER_ADMIN_APPROVAL_TOKEN || "");
      if (!expectedApproval || !approval || approval.length > 4096 || (await digest(approval)) !== (await digest(expectedApproval))) return json({ error: "OWNER_APPROVAL_REQUIRED" }, 403);
    }
    const target = operation.buildPath(input);
    if (!target) return json({ error: "INVALID_OPERATION_PAYLOAD" }, 400);

    let profiles;
    try { profiles = parseProfiles(env); } catch { return json({ error: "TOKEN_PROFILE_CONFIG_INVALID" }, 503); }
    const selected = selectToken(profiles, env, operation.permissions, target.scope);
    if (!selected) return json({ error: "NO_ENABLED_TOKEN_COVERS_REQUEST" }, 403);

    try {
      const result = await cloudflareRequest(operation.method, target.path, selected.token, target.body, target.script_content);
      const audit = { operation: input.operation, token_id: selected.p.token_id, permissions: operation.permissions, resource_scope: target.scope, privileged: operation.privileged === true, outcome: result.ok ? "success" : "failure", http_status: result.status };
      if (!result.ok) return json({ error: result.error, audit }, result.status === 401 || result.status === 403 ? 502 : result.status);
      return json({ ok: true, result: result.payload.result ?? null, audit }, 200);
    } catch {
      return json({ error: "CLOUDFLARE_NETWORK_ERROR", audit: { operation: input.operation, resource_scope: target.scope, outcome: "network_error" } }, 502);
    }
  },
};

export { covers, parseProfiles, safeId, selectToken, OPERATIONS };
