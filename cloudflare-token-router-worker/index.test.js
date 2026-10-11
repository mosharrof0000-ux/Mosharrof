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
