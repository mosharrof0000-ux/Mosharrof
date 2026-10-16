import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const registry = require("../core/android-agent-capabilities.js");

const all = registry.listCapabilities();
assert.ok(all.length >= 20, "capability inventory should cover major domains");
assert.equal(new Set(all.map(x => x.id)).size, all.length, "capability IDs must be unique");
assert.equal(registry.readiness("device.open_settings").ready, true);
assert.equal(registry.readiness("files.delete").ready, false);
assert.equal(registry.readiness("media.duplicates.delete").status, "planned");
assert.equal(registry.readiness("security.credentials").status, "blocked");
assert.equal(registry.readiness("security.payment_submit").ready, false);
assert.equal(registry.readiness("does.not.exist").status, "unknown");
assert.equal(registry.readiness("device.accessibility.tap_swipe", ["accessibility_service"]).ready, false,
  "a permission cannot make an unimplemented capability ready");
console.log("Android capability registry contract: PASS");
