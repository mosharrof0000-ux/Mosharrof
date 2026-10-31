import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const protocolSource = (await readFile(new URL("../organs/android-agent-bridge/worker/device-bridge-protocol.js", import.meta.url), "utf8"))
  .replace(/^export const /gm, "const ")
  .replace(/^export async function /gm, "async function ")
  .replace(/^export function /gm, "function ");
const source = (await readFile(new URL("../organs/android-agent-bridge/worker/device-bridge.js", import.meta.url), "utf8"))
  .replace(/^import \{[^}]+\} from "\.\/device-bridge-protocol\.js";\s*/m, protocolSource + "\n");
const { DeviceBridge } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

class MemoryStorage {
  constructor() { this.values = new Map(); }
  async get(key) {
    const value = this.values.get(key);
    return value === undefined ? undefined : structuredClone(value);
  }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async delete(key) { this.values.delete(key); }
  async deleteAll() { this.values.clear(); }
}
function fixture() {
  const storage = new MemoryStorage();
  return { storage, bridge: new DeviceBridge({ storage }, {}) };
}
async function call(bridge, path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = "Bearer " + token;
  const response = await bridge.fetch(new Request("https://bridge.test" + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  }));
  return { status: response.status, data: await response.json() };
}
async function verifySignature(secretHex, envelope) {
  const bytes = value => new Uint8Array(value.match(/.{2}/g).map(pair => parseInt(pair, 16)));
  const payload = [
    "mosharrof-device-command-v1", envelope.requestId, envelope.action,
    String(envelope.issuedAtMillis), String(envelope.expiresAtMillis),
    envelope.nonce, envelope.target
  ].join("\n");
  const key = await crypto.subtle.importKey("raw", bytes(secretHex), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, bytes(envelope.signatureHex), new TextEncoder().encode(payload));
}

const secret = "ab".repeat(32);
const deviceId = "device-123456789012";
{
  const { bridge } = fixture();
  const started = await call(bridge, "/device/pair/start", {
    method: "POST", body: { deviceId, pairingCode: "123456", deviceSecret: secret }
  });
  assert.equal(started.status, 200);
  assert.equal(started.data.ok, true);

  const wrong = await call(bridge, "/device/pair/approve", { method: "POST", body: { pairingCode: "000000" } });
  assert.equal(wrong.status, 401);

  const approved = await call(bridge, "/device/pair/approve", { method: "POST", body: { pairingCode: "123456" } });
  assert.equal(approved.status, 200);
  assert.equal(approved.data.ok, true);
  assert.ok(approved.data.browserToken);

  const status = await call(bridge, "/device/pair/status", { token: secret });
  assert.equal(status.data.paired, true);
  assert.equal(status.data.deviceId, deviceId);

  const unauthenticated = await call(bridge, "/device/commands", {
    method: "POST", token: "wrong-token", body: { action: "UNINSTALL_APP", target: "YouTube" }
  });
  assert.equal(unauthenticated.status, 401);

  const malformed = await call(bridge, "/device/commands", {
    method: "POST", token: approved.data.browserToken,
    body: { action: "UNINSTALL_APP", target: "rm -rf /" }
  });
  assert.equal(malformed.status, 400);

  const queued = await call(bridge, "/device/commands", {
    method: "POST", token: approved.data.browserToken,
    body: { action: "UNINSTALL_APP", target: "YouTube" }
  });
  assert.equal(queued.status, 202);
  assert.equal(queued.data.status, "REQUESTED");

  const polled = await call(bridge, "/device/poll", { token: secret });
  assert.equal(polled.status, 200);
  assert.equal(polled.data.command.requestId, queued.data.requestId);
  assert.equal(polled.data.command.action, "UNINSTALL_APP");
  assert.equal(await verifySignature(secret, polled.data.command), true);

  const busy = await call(bridge, "/device/poll", { token: secret });
  assert.equal(busy.data.busy, true);
  assert.equal(busy.data.command, null);

  const falseSuccess = await call(bridge, "/device/result", {
    method: "POST", token: secret,
    body: { requestId: queued.data.requestId, action: "UNINSTALL_APP", status: "SUCCEEDED",
      detail: "not verified", packageName: "com.example.app", packageStateVerified: false }
  });
  assert.equal(falseSuccess.status, 400);

  const accepted = await call(bridge, "/device/result", {
    method: "POST", token: secret,
    body: { requestId: queued.data.requestId, action: "UNINSTALL_APP", status: "SUCCEEDED",
      detail: "package absent", packageName: "com.example.app", packageStateVerified: true }
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.data.terminal, true);

  const result = await call(bridge, "/device/results?requestId=" + queued.data.requestId, { token: approved.data.browserToken });
  assert.equal(result.data.result.status, "SUCCEEDED");

  const revoked = await call(bridge, "/device/revoke", { method: "POST", token: approved.data.browserToken, body: {} });
  assert.equal(revoked.data.revoked, true);
  const afterRevoke = await call(bridge, "/device/poll", { token: secret });
  assert.equal(afterRevoke.status, 401);
}
{
  const { bridge, storage } = fixture();
  await call(bridge, "/device/pair/start", {
    method: "POST", body: { deviceId, pairingCode: "654321", deviceSecret: secret }
  });
  const pending = await storage.get("pairing");
  pending.expiresAt = Date.now() - 1;
  await storage.put("pairing", pending);
  const expired = await call(bridge, "/device/pair/approve", { method: "POST", body: { pairingCode: "654321" } });
  assert.equal(expired.status, 410);
}
{
  const { bridge, storage } = fixture();
  await call(bridge, "/device/pair/start", {
    method: "POST", body: { deviceId, pairingCode: "987654", deviceSecret: secret }
  });
  for (let i = 0; i < 5; i++) {
    const response = await call(bridge, "/device/pair/approve", { method: "POST", body: { pairingCode: "111111" } });
    assert.equal(response.status, 401);
  }
  assert.equal(await storage.get("pairing"), undefined);
}
console.log("device bridge worker tests passed");
