import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { runWithRecovery } = require("../core/android-agent-recovery.js");
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
console.log("Android agent bounded recovery contract: PASS");
