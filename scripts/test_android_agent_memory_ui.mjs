import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui = readFileSync("core/android-agent-memory-ui.js", "utf8");
const manifest = readFileSync("scripts/android/prepare-agent-web-assets.py", "utf8");
assert.ok(ui.includes("localStorage") && ui.includes("window.confirm"));
assert.ok(ui.includes("memory.clear()") && ui.includes("memory.forget(record.id)"));
assert.ok(ui.includes("memory.search(embed(term)"));
assert.ok(manifest.includes('"android-agent-memory-ui.js"'));
console.log("Android agent memory UI contract: PASS");
