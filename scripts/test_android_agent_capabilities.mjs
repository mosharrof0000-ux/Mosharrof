import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const registry = require("../core/android-agent-capabilities.js");

const all = registry.listCapabilities();
assert.ok(all.length >= 20, "capability inventory should cover major domains");
assert.equal(new Set(all.map(x => x.id)).size, all.length, "capability IDs must be unique");
assert.equal(registry.readiness("device.open_settings").ready, true);
assert.equal(registry.readiness("files.delete").ready, false, "SAF consent is required");
assert.equal(registry.readiness("files.delete", ["storage_access_framework"]).ready, true);
assert.equal(registry.readiness("folders.create", ["storage_access_framework"]).ready, true);
assert.equal(registry.readiness("media.duplicates.delete").status, "planned");
assert.equal(registry.readiness("security.credentials").status, "blocked");
assert.equal(registry.readiness("security.payment_submit").ready, false);
assert.equal(registry.readiness("does.not.exist").status, "unknown");
assert.equal(registry.readiness("device.accessibility.tap_swipe", ["accessibility_service"]).ready, true,
  "owner-enabled, confirmed accessibility actions are mediated and available");
assert.equal(registry.readiness("screen.capture", ["media_projection_consent"]).ready, false,
  "screen capture remains unavailable until the consented capture pipeline exists");
console.log("Android capability registry contract: PASS");
const { createExecutor } = require("../core/android-agent-executor.js");
const safePlan = { status: "preview", steps: [
  { action: "test_action", capability: "test.capability", requiresConfirmation: false }
] };
let executed = 0;
let verified = 0;
const safeExecutor = createExecutor({
  adapter: { async execute() { executed++; return { ok: true }; } },
  verify: async () => { verified++; return { ok: true, evidence: "test-only observation" }; },
  isCapabilityReady: () => true
});
const execution = await safeExecutor.run(safePlan);
assert.equal(execution.status, "completed");
assert.equal(execution.steps[0].status, "verified");
assert.equal(executed, 1);
assert.equal(verified, 1);
const unavailable = await createExecutor().run(safePlan);
assert.equal(unavailable.status, "unavailable");
const blocked = await createExecutor({
  adapter: { async execute() { return { ok: true }; } },
  verify: async () => ({ ok: true }),
  isCapabilityReady: () => false
}).run(safePlan);
assert.equal(blocked.status, "blocked");
const unverified = await createExecutor({
  adapter: { async execute() { return { ok: true }; } },
  verify: async () => ({ ok: false, reason: "not observed" }),
  isCapabilityReady: () => true
}).run(safePlan);
assert.equal(unverified.status, "failed");
assert.equal(unverified.steps[0].status, "failed");
console.log("Android agent executor contract: PASS");
