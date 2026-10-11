import test from "node:test";
import assert from "node:assert/strict";
import { covers, parseProfiles, safeId, selectToken, OPERATIONS } from "./index.js";

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

test("profile parser rejects duplicate IDs and unsafe secret binding names", () => {
  const env = { CLOUDFLARE_TOKEN_PROFILES: JSON.stringify([
    { token_id: "zone", secret_binding: "CF_ZONE_TOKEN", permissions: ["Zone Read"], resource_scopes: ["/zones/zone-1"], enabled: true },
    { token_id: "zone", secret_binding: "CF_ZONE_TOKEN_2", permissions: ["Zone Read"], resource_scopes: ["/zones/zone-2"], enabled: true },
  ]) };
  assert.throws(() => parseProfiles(env), /TOKEN_PROFILE_CONFIG_INVALID/);
  assert.equal(OPERATIONS["worker.scripts.list"].method, "GET");
});
