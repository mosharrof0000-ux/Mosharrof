import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { runWithRecovery } = require("../core/android-agent-recovery.js");
const { createExecutor } = require("../core/android-agent-executor.js");
const attempts = [{ id: "label", action: "tap_label" }, { id: "settings", action: "open_settings" }];
let executions = 0;
let result = await runWithRecovery({
  attempts,
  execute: async candidate => { executions++; return candidate.id === "label" ? { ok: false, reason: "not found" } : { ok: true }; },
  verify: async candidate => ({ ok: candidate.id === "settings", evidence: "settings page observed" }),
  isSafeToRetry: candidate => candidate.id === "settings"
});
assert.equal(result.status, "recovered");
assert.equal(result.selected, "settings");
assert.equal(executions, 2);
result = await runWithRecovery({
  attempts,
  execute: async () => ({ ok: false }),
  verify: async () => ({ ok: false }),
  isSafeToRetry: () => false
});
assert.equal(result.status, "failed");
assert.equal(result.attempts.length, 2);
result = await runWithRecovery({ attempts: [{ id: "one", action: "tap" }, { id: "two", action: "tap" }],
  execute: async () => ({ ok: false }), verify: async () => ({ ok: true }), isSafeToRetry: () => false });
assert.equal(result.attempts[1].status, "blocked");

let recoveryCalls = 0;
result = await createExecutor({
  recovery: { runWithRecovery },
  adapter: { async execute(step) {
    recoveryCalls++;
    return step.action === "tap_old_label" ? { ok: false, reason: "label not found" } : { ok: true };
  } },
  verify: async step => ({ ok: step.action === "open_settings", evidence: "settings intent opened" }),
  isCapabilityReady: () => true,
  getRecoveryAttempts: () => [{
    id: "approved-settings-fallback", action: "open_settings", capability: "settings.open",
    risk: "navigation", requiresConfirmation: false
  }],
  isSafeToRetry: (candidate, original) => candidate.action === "open_settings" &&
    original.action === "tap_old_label"
}).run({ status: "preview", steps: [
  { action: "tap_old_label", capability: "ui.tap", requiresConfirmation: false }
] });
assert.equal(result.status, "completed");
assert.equal(result.steps[0].status, "recovered");
assert.equal(recoveryCalls, 2);

console.log("Android agent bounded recovery + executor integration contract: PASS");
