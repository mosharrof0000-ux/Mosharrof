import test from "node:test";
import assert from "node:assert/strict";
import worker, { OPERATIONS } from "../core/cloudflare-token-router/index.js";

test("privileged write operations fail closed until separately enabled and owner-approved", async () => {
  const env = {
    ROUTER_ACCESS_TOKEN: "router-key",
    CLOUDFLARE_TOKEN_PROFILES: "[]",
  };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("must not reach upstream"); };
  try {
    const disabled = await worker.fetch(new Request("https://router.example/v1/operation", {
      method: "POST", headers: { authorization: "Bearer router-key", "content-type": "application/json" },
      body: JSON.stringify({ operation: "worker.secret.write", account_id: "acct1", script_name: "app", secret_name: "API_KEY", secret_value: "sensitive" }),
    }), env);
    assert.equal(disabled.status, 403);
    assert.equal((await disabled.json()).error, "PRIVILEGED_OPERATIONS_DISABLED");
    env.PRIVILEGED_OPERATIONS_ENABLED = "true";
    const noApproval = await worker.fetch(new Request("https://router.example/v1/operation", {
      method: "POST", headers: { authorization: "Bearer router-key", "content-type": "application/json" },
      body: JSON.stringify({ operation: "worker.secret.write", account_id: "acct1", script_name: "app", secret_name: "API_KEY", secret_value: "sensitive" }),
    }), env);
    assert.equal(noApproval.status, 403);
    assert.equal((await noApproval.json()).error, "OWNER_APPROVAL_REQUIRED");
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("privileged operations have strict resource and payload allowlists", () => {
  assert.equal(OPERATIONS["worker.secret.write"].method, "PUT");
  assert.equal(OPERATIONS["worker.script.deploy"].method, "PUT");
  assert.equal(OPERATIONS["token.create"].method, "POST");
  assert.equal(OPERATIONS["token.create"].buildPath({ token_name: "Router test", policies: [{ effect: "deny", permission_groups: [{ id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }], resources: { aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: ["*"] } }] }), null);
  assert.equal(OPERATIONS["worker.secret.write"].buildPath({ account_id: "../user", script_name: "app", secret_name: "X", secret_value: "v" }), null);
});

test("token creation uses Cloudflare resource-map schema and bounded expiry", () => {
  const op = OPERATIONS["token.create"];
  const valid = op.buildPath({
    token_name: "Router least privilege",
    expires_in: 60,
    policies: [{
      effect: "allow",
      permission_groups: [{ id: "c8fed203ed3043cba015a93ad1616f1f" }],
      resources: { "com.cloudflare.api.account.zone.22b1de5f1c0e4b3ea97bb1e963b06a43": "*" },
    }],
  });
  assert.ok(valid);
  assert.equal(valid.body.name, "Router least privilege");
  assert.match(valid.body.expires_on, /^20\d\d-/);
  assert.equal(op.buildPath({
    token_name: "Router least privilege", expires_in: 1441,
    policies: [{ effect: "allow", permission_groups: [{ id: "c8fed203ed3043cba015a93ad1616f1f" }], resources: { "com.cloudflare.api.account.zone.22b1de5f1c0e4b3ea97bb1e963b06a43": "*" } }],
  }), null);
  assert.equal(op.buildPath({
    token_name: "Router least privilege",
    policies: [{ effect: "allow", permission_groups: [{ id: "c8fed203ed3043cba015a93ad1616f1f" }], resources: { "com.cloudflare.api.account.zone.22b1de5f1c0e4b3ea97bb1e963b06a43": ["*"] } }],
  }), null);
});

test("router refuses to revoke the credential currently authenticating upstream", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("must not reach upstream"); };
  try {
    const response = await worker.fetch(new Request("https://router.example/v1/operation", {
      method: "POST",
      headers: {
        authorization: "Bearer router-key",
        "x-router-admin-approval": "owner-approval",
        "content-type": "application/json",
      },
      body: JSON.stringify({ operation: "token.revoke", token_id: "active-router-token" }),
    }), {
      ROUTER_ACCESS_TOKEN: "router-key",
      ROUTER_ADMIN_APPROVAL_TOKEN: "owner-approval",
      PRIVILEGED_OPERATIONS_ENABLED: "true",
      CLOUDFLARE_TOKEN_PROFILES: JSON.stringify([{
        token_id: "active-router-token",
        secret_binding: "CF_API_TOKEN",
        permissions: ["API Tokens Write"],
        resource_scopes: ["/user/tokens"],
        enabled: true,
      }]),
      CF_API_TOKEN: "provider-secret",
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error, "CANNOT_REVOKE_ACTIVE_ROUTER_CREDENTIAL");
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});
