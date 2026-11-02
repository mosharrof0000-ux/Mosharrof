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
      const resourceKey = (key) => typeof key === "string" && (/^com\.cloudflare\.api\.user\.[A-Za-z0-9_-]{32}$/.test(key) || /^com\.cloudflare\.api\.account\.[A-Za-z0-9_-]{32}$/.test(key) || /^com\.cloudflare\.api\.account\.zone\.[A-Za-z0-9_-]{32}$/.test(key)) && !/[\r\n]/.test(key);
      const resourceValue = (value) => value === "*" || (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0 && Object.entries(value).every(([key, nested]) => /^com\.cloudflare\.api\.account\.zone\.(\*|[A-Za-z0-9_-]{32})$/.test(key) && nested === "*"));
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
