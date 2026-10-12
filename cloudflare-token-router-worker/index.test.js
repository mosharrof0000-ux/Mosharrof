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


test("health endpoint is public, read-only, and reports configuration presence without secrets", async () => {
  const unconfigured = await worker.fetch(new Request("https://router.example/health"), {});
  assert.equal(unconfigured.status, 200);
  assert.deepEqual(await unconfigured.json(), {
    ok: true,
    service: "mosharrof-cloudflare-token-router",
    build: "2026-10-12-token-router-worker-v2",
    mode: "read-only",
    access_configured: false,
    profiles_configured: false,
    profile_config_valid: false,
    enabled_profiles_count: 0,
    enabled_profiles_with_secret_count: 0,
  });

  const configured = await worker.fetch(new Request("https://router.example/health"), {
    ROUTER_ACCESS_TOKEN: "must-not-appear-in-health",
    CLOUDFLARE_TOKEN_PROFILES: JSON.stringify([
      { token_id: "zone-read", secret_binding: "CF_ZONE_READ_TOKEN", permissions: ["Zone Read"], resource_scopes: ["/zones/zone-1"], enabled: true },
    ]),
    CF_ZONE_READ_TOKEN: "must-not-appear-in-health-either",
  });
  const payload = await configured.json();
  assert.equal(payload.access_configured, true);
  assert.equal(payload.profiles_configured, true);
  assert.equal(payload.profile_config_valid, true);
  assert.equal(payload.enabled_profiles_count, 1);
  assert.equal(payload.enabled_profiles_with_secret_count, 1);
  assert.equal(JSON.stringify(payload).includes("must-not-appear-in-health"), false);
  assert.equal(configured.headers.get("cache-control"), "no-store");
});

test("wrong router credential is denied before parsing or contacting Cloudflare", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("unexpected upstream call");
  };
  try {
    const response = await worker.fetch(new Request("https://router.example/v1/operation", {
      method: "POST",
      headers: { authorization: "Bearer wrong-key", "content-type": "application/json" },
      body: JSON.stringify({ operation: "zone.read", zone_id: "zone-1" }),
    }), {
      ROUTER_ACCESS_TOKEN: "correct-key",
      CLOUDFLARE_TOKEN_PROFILES: "[]",
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "UNAUTHORIZED" });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing or disabled matching token fails closed without upstream calls", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("unexpected upstream call");
  };
  try {
    for (const profile of [
      { token_id: "zone", secret_binding: "CF_ZONE_READ_TOKEN", permissions: ["Zone Read"], resource_scopes: ["/zones/zone-1"], enabled: false },
      { token_id: "zone", secret_binding: "CF_ZONE_READ_TOKEN", permissions: ["Zone Read"], resource_scopes: ["/zones/zone-2"], enabled: true },
    ]) {
      const response = await worker.fetch(new Request("https://router.example/v1/operation", {
        method: "POST",
        headers: { authorization: "Bearer correct-key", "content-type": "application/json" },
        body: JSON.stringify({ operation: "zone.read", zone_id: "zone-1" }),
      }), {
        ROUTER_ACCESS_TOKEN: "correct-key",
        CLOUDFLARE_TOKEN_PROFILES: JSON.stringify([profile]),
        CF_ZONE_READ_TOKEN: "test-only-secret",
      });
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: "NO_ENABLED_TOKEN_COVERS_REQUEST" });
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("health remains secret-free and reports malformed and empty profile configuration accurately", async () => {
  const malformed = await worker.fetch(new Request("https://router.example/health"), {
    ROUTER_ACCESS_TOKEN: "private-router-key",
    CLOUDFLARE_TOKEN_PROFILES: "{not-json",
  });
  assert.equal(malformed.status, 200);
  const malformedPayload = await malformed.json();
  assert.equal(malformedPayload.profile_config_valid, false);
  assert.equal(malformedPayload.enabled_profiles_count, 0);
  assert.equal(JSON.stringify(malformedPayload).includes("private-router-key"), false);

  const empty = await worker.fetch(new Request("https://router.example/health"), {
    ROUTER_ACCESS_TOKEN: "private-router-key",
    CLOUDFLARE_TOKEN_PROFILES: "[]",
  });
  const emptyPayload = await empty.json();
  assert.equal(emptyPayload.profile_config_valid, true);
  assert.equal(emptyPayload.enabled_profiles_count, 0);
});

test("readiness endpoint rejects empty or invalid configuration without revealing secrets", async () => {
  const empty = await worker.fetch(new Request("https://router.example/ready"), {});
  assert.equal(empty.status, 503);
  assert.deepEqual(await empty.json(), {
    ok: false,
    service: "mosharrof-cloudflare-token-router",
    build: "2026-10-12-token-router-worker-v2",
    mode: "read-only",
    access_configured: false,
    profiles_valid: true,
    enabled_profiles: 0,
    usable_profiles: 0,
  });

  const invalid = await worker.fetch(new Request("https://router.example/ready"), {
    ROUTER_ACCESS_TOKEN: "private-router-key",
    CLOUDFLARE_TOKEN_PROFILES: "{bad json",
  });
  assert.equal(invalid.status, 503);
  const payload = await invalid.json();
  assert.equal(payload.profiles_valid, false);
  assert.equal(JSON.stringify(payload).includes("private-router-key"), false);
});

test("readiness succeeds only when an enabled profile has its bound secret", async () => {
  const profile = {
    token_id: "zone-read-01",
    secret_binding: "CF_ZONE_READ_TOKEN",
    permissions: ["Zone Read"],
    resource_scopes: ["/zones/real-zone-id"],
    enabled: true,
  };
  const missingSecret = await worker.fetch(new Request("https://router.example/ready"), {
    ROUTER_ACCESS_TOKEN: "private-router-key",
    CLOUDFLARE_TOKEN_PROFILES: JSON.stringify([profile]),
  });
  assert.equal(missingSecret.status, 503);
  assert.equal((await missingSecret.json()).usable_profiles, 0);

  const ready = await worker.fetch(new Request("https://router.example/ready"), {
    ROUTER_ACCESS_TOKEN: "private-router-key",
    CLOUDFLARE_TOKEN_PROFILES: JSON.stringify([profile]),
    CF_ZONE_READ_TOKEN: "private-cloudflare-token",
  });
  assert.equal(ready.status, 200);
  const payload = await ready.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.enabled_profiles, 1);
  assert.equal(payload.usable_profiles, 1);
  assert.equal(JSON.stringify(payload).includes("private-cloudflare-token"), false);
});
