import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createExecutor } = require("../core/android-agent-executor.js");

const plan = { status: "preview", steps: [
  { action: "open_wifi_settings", capability: "wifi", requiresConfirmation: false },
  { action: "delete_file", capability: "files.delete", requiresConfirmation: true }
] };

let calls = 0;
let verifierCalls = 0;
const executor = createExecutor({
  adapter: { async execute(step) { calls++; return { ok: true, action: step.action }; } },
  verify: async (step) => { verifierCalls++; return { ok: true, evidence: step.action + ": observed" }; },
  isCapabilityReady: () => true,
  confirm: async () => true
});
let result = await executor.run(plan);
assert.equal(result.status, "completed");
assert.equal(result.steps.length, 2);
assert.equal(result.steps.every(s => s.status === "verified"), true);
assert.equal(calls, 2);
assert.equal(verifierCalls, 2);

result = await createExecutor().run(plan);
assert.equal(result.status, "unavailable");
assert.equal(result.steps.length, 0);

result = await createExecutor({
  adapter: { async execute() { return { ok: true }; } },
  verify: async () => ({ ok: true }),
  isCapabilityReady: () => false
}).run(plan);
assert.equal(result.status, "blocked");
assert.equal(result.steps.length, 1);

result = await createExecutor({
  adapter: { async execute() { return { ok: true }; } },
  verify: async () => ({ ok: true }),
  isCapabilityReady: () => true,
  confirm: async () => false
}).run(plan);
assert.equal(result.status, "cancelled");
assert.equal(result.steps[0].status, "verified");
assert.equal(result.steps[1].status, "cancelled");

result = await createExecutor({
  adapter: { async execute() { return { ok: true }; } },
  verify: async () => ({ ok: false, reason: "state mismatch" }),
  isCapabilityReady: () => true
}).run({ status: "preview", steps: [plan.steps[0]] });
assert.equal(result.status, "failed");
assert.equal(result.steps[0].status, "failed");

result = await createExecutor().run({ status: "unsupported", steps: [] });
assert.equal(result.status, "rejected");
console.log("Android agent executor contract: PASS");
