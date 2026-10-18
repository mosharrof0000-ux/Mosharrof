import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createExecutor } = require("../core/android-agent-executor.js");
const { runWithRecovery } = require("../core/android-agent-recovery.js");
let recoveryCalls = 0;
const result = await createExecutor({
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
console.log("Android agent executor recovery integration: PASS");
