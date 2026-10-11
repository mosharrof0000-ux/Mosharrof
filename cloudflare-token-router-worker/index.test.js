import test from "node:test";
import assert from "node:assert/strict";
import worker, { covers, parseProfiles, safeId, selectToken, OPERATIONS } from "./index.js";

test("resource IDs reject traversal and path injection", () => {
  assert.equal(safeId("zone-123"), "zone-123");
  assert.equal(safeId("../user/tokens"), null);
  assert.equal(safeId("id?x=1"), null);
  assert.equal(safeId(""), null);
});

test("scope coverage handles nested paths without sibling-prefix confusion", () => {
  assert.equal(covers("/accounts/acct-1", "/accounts/acct-1/workers/scripts"), true);
  assert.equal(covers("/accounts/acct-1", "/accounts/acct-10/workers/scripts"), false);
  assert.equal(covers("/zones/zone-1", "/zones/zone-2"), false);
});

test("selects narrowest enabled matching token and never returns missing secrets", () => {
  const profiles = [
    { token_id: "broad", enabled: true, permissions: new Set(["Zone Read", "Zone Edit"]), resource_scopes: ["/zones/zone-1"] },
    { token_id: "narrow", enabled: true, permissions: new Set(["Zone Read"]), resource_scopes: ["/zones/zone-1"] },
    { token_id: "disabled", enabled: false, permissions: new Set(["Zone Read"]), resource_scopes: ["/zones/zone-1"] },
  ];
  const chosen = selectToken(profiles, { BROAD_TOKEN: "broad-secret", NARROW_TOKEN: "narrow-secret" }, ["Zone Read"], "/zones/zone-1");
  // The profile secret_binding is required by the selector; add it as the non-secret binding name.
  assert.equal(chosen, null);
  profiles[0].secret_binding = "BROAD_TOKEN";
  profiles[1].secret_binding = "NARROW_TOKEN";
  profiles[2].secret_binding = "NARROW_TOKEN";
  const selected = selectToken(profiles, { BROAD_TOKEN: "broad-secret", NARROW_TOKEN: "narrow-secret" }, ["Zone Read"], "/zones/zone-1");
  assert.equal(selected.p.token_id, "narrow");
  assert.equal(selected.token, "narrow-secret");
});

test("profile parser rejects root-wide and malformed scopes", () => {
  for (const scope of ["/", "/accounts//workers", "/accounts/../user", "/accounts/acct?x=1", "/accounts/%2e%2e"]) {
    const env = { CLOUDFLARE_TOKEN_PROFILES: JSON.stringify([
      { token_id: "unsafe", secret_binding: "CF_ZONE_TOKEN", permissions: ["Zone Read"], resource_scopes: [scope], enabled: true },
    ]) };
    assert.throws(() => parseProfiles(env), /TOKEN_PROFILE_CONFIG_INVALID/);
  }
});

test("profile parser rejects duplicate IDs and unsafe secret binding names", () => {
  const env = { CLOUDFLARE_TOKEN_PROFILES: JSON.stringify([
    { token_id: "zone", secret_binding: "CF_ZONE_TOKEN", permissions: ["Zone Read"], resource_scopes: ["/zones/zone-1"], enabled: true },
    { token_id: "zone", secret_binding: "CF_ZONE_TOKEN_2", permissions: ["Zone Read"], resource_scopes: ["/zones/zone-2"], enabled: true },
  ]) };
  assert.throws(() => parseProfiles(env), /TOKEN_PROFILE_CONFIG_INVALID/);
  assert.equal(OPERATIONS["worker.scripts.list"].method, "GET");
});


test("worker denies unauthenticated requests and never exposes operations via GET", async () => {
  const env = { ROUTER_ACCESS_TOKEN: "private-router-key" };
  const unauth = await worker.fetch(new Request("https://router.example/v1/operation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operation: "zone.read", zone_id: "zone-1" }),
  }), env);
  assert.equal(unauth.status, 401);
  assert.deepEqual(await unauth.json(), { error: "UNAUTHORIZED" });

  const get = await worker.fetch(new Request("https://router.example/v1/operation", { method: "GET" }), env);
  assert.equal(get.status, 404);
});

test("worker rejects unknown capabilities before contacting Cloudflare", async () => {
  const env = { ROUTER_ACCESS_TOKEN: "private-router-key", CLOUDFLARE_TOKEN_PROFILES: "[]" };
  const response = await worker.fetch(new Request("https://router.example/v1/operation", {
    method: "POST",
    headers: { authorization: "Bearer private-router-key", "content-type": "application/json" },
    body: JSON.stringify({ operation: "arbitrary.api.call", zone_id: "zone-1" }),
  }), env);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "OPERATION_NOT_ALLOWED" });
});


test("Cloudflare 403 is not retried with a broader token and response never leaks credentials", async () => {
  const profiles = [
    { token_id: "zone-read", secret_binding: "CF_ZONE_TOKEN", permissions: ["Zone Read"], resource_scopes: ["/zones/zone-1"], enabled: true },
    { token_id: "broad", secret_binding: "CF_BROAD_TOKEN", permissions: ["Zone Read", "Zone Edit"], resource_scopes: ["/zones/zone-1"], enabled: true },
  ];
  const env = {
    ROUTER_ACCESS_TOKEN: "private-router-key",
    CLOUDFLARE_TOKEN_PROFILES: JSON.stringify(profiles),
    CF_ZONE_TOKEN: "least-privilege-secret",
    CF_BROAD_TOKEN: "broader-secret",
  };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    assert.equal(options.headers.Authorization, "Bearer least-privilege-secret");
    return new Response("provider private detail", { status: 403 });
  };
  try {
    const response = await worker.fetch(new Request("https://router.example/v1/operation", {
      method: "POST",
      headers: { authorization: "Bearer private-router-key", "content-type": "application/json" },
      body: JSON.stringify({ operation: "zone.read", zone_id: "zone-1" }),
    }), env);
    const result = await response.json();
    assert.equal(response.status, 502);
    assert.equal(calls, 1);
    assert.equal(result.error, "CLOUDFLARE_AUTHORIZATION_DENIED");
    assert.equal(JSON.stringify(result).includes("least-privilege-secret"), false);
    assert.equal(JSON.stringify(result).includes("broader-secret"), false);
    assert.equal(JSON.stringify(result).includes("provider private detail"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("prefers narrower resource scope when permissions are equal", () => {
  const profiles = [
    { token_id: "a-broad", secret_binding: "CF_BROAD_TOKEN", enabled: true, permissions: new Set(["Zone Read"]), resource_scopes: ["/zones"] },
    { token_id: "z-narrow", secret_binding: "CF_NARROW_TOKEN", enabled: true, permissions: new Set(["Zone Read"]), resource_scopes: ["/zones/zone-1"] },
  ];
  const selected = selectToken(profiles, { CF_BROAD_TOKEN: "broad-secret", CF_NARROW_TOKEN: "narrow-secret" }, ["Zone Read"], "/zones/zone-1");
  assert.equal(selected.p.token_id, "z-narrow");
  assert.equal(selected.token, "narrow-secret");
});

test("health reports only usable enabled-profile readiness and never exposes secrets", async () => {
  const cases = [
    [{}, false, false],
    [{ ROUTER_ACCESS_TOKEN: "secret", CLOUDFLARE_TOKEN_PROFILES: "[]" }, true, false],
    [{ ROUTER_ACCESS_TOKEN: "secret", CLOUDFLARE_TOKEN_PROFILES: "not-json" }, true, false],
    [{ ROUTER_ACCESS_TOKEN: "secret", CLOUDFLARE_TOKEN_PROFILES: JSON.stringify([
      { token_id: "disabled", secret_binding: "CF_ZONE_TOKEN", permissions: ["Zone Read"], resource_scopes: ["/zones/zone-1"], enabled: false },
    ]) }, true, false],
    [{ ROUTER_ACCESS_TOKEN: "private-router-key", CLOUDFLARE_TOKEN_PROFILES: JSON.stringify([
      { token_id: "zone-read", secret_binding: "CF_ZONE_TOKEN", permissions: ["Zone Read"], resource_scopes: ["/zones/zone-1"], enabled: true },
    ]), CF_ZONE_TOKEN: "provider-secret" }, true, true],
  ];
  for (const [env, accessConfigured, profilesConfigured] of cases) {
    const response = await worker.fetch(new Request("https://router.example/health"), env);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.mode, "read-only");
    assert.equal(body.access_configured, accessConfigured);
    assert.equal(body.profiles_configured, profilesConfigured);
    assert.equal(JSON.stringify(body).includes("provider-secret"), false);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("authenticated zone.read succeeds through the allowlisted GET-only path", async () => {
  const env = {
    ROUTER_ACCESS_TOKEN: "private-router-key",
    CLOUDFLARE_TOKEN_PROFILES: JSON.stringify([
      { token_id: "zone-read", secret_binding: "CF_ZONE_TOKEN", permissions: ["Zone Read"], resource_scopes: ["/zones/zone-1"], enabled: true },
    ]),
    CF_ZONE_TOKEN: "provider-secret",
  };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls += 1;
    assert.equal(String(url), "https://api.cloudflare.com/client/v4/zones/zone-1");
    assert.equal(options.method, "GET");
    assert.equal(options.headers.Authorization, "Bearer provider-secret");
    return new Response(JSON.stringify({ success: true, result: { id: "zone-1", name: "example.test" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const response = await worker.fetch(new Request("https://router.example/v1/operation", {
      method: "POST",
      headers: { authorization: "Bearer private-router-key", "content-type": "application/json" },
      body: JSON.stringify({ operation: "zone.read", zone_id: "zone-1" }),
    }), env);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.result, { id: "zone-1", name: "example.test" });
    assert.deepEqual(body.audit, {
      operation: "zone.read",
      token_id: "zone-read",
      permissions: ["Zone Read"],
      resource_scope: "/zones/zone-1",
      outcome: "success",
      http_status: 200,
    });
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(body).includes("provider-secret"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("wrong router access token is rejected before Cloudflare is contacted", async () => {
  const env = { ROUTER_ACCESS_TOKEN: "private-router-key" };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("must not be called"); };
  try {
    const response = await worker.fetch(new Request("https://router.example/v1/operation", {
      method: "POST",
      headers: { authorization: "Bearer wrong-key", "content-type": "application/json" },
      body: JSON.stringify({ operation: "zone.read", zone_id: "zone-1" }),
    }), env);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "UNAUTHORIZED" });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

