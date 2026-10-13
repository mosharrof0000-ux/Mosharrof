// This contract complements the native APK build; passing it alone does not prove device behavior.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/build-apk.yml", "utf8");
const ui = readFileSync("web/voice-companion.js", "utf8");
const tile = readFileSync("native/android/MosharrofVoiceTileService.java", "utf8");
const bubble = readFileSync("native/android/MosharrofBubbleService.java", "utf8");
const page = readFileSync("web/index.html", "utf8");

assert.ok(ui.includes("mosharrofVoiceDock"));
assert.ok(ui.includes("composerVoiceBtn"));
assert.ok(ui.includes("translateX(calc(100% - 9px)"), "Dock should stay tucked to the screen edge when closed");
assert.ok(ui.includes("mosharrof:open-voice"));
assert.ok(tile.includes("TileService"));
assert.ok(tile.includes("OPEN_VOICE"));
assert.ok(bubble.includes("Settings.canDrawOverlays"));
assert.ok(bubble.includes("TYPE_APPLICATION_OVERLAY"));
assert.ok(bubble.includes("startForeground"));
assert.ok(!bubble.includes("AccessibilityService"));
assert.ok(workflow.includes("MosharrofVoiceTileService.java"));
assert.ok(workflow.includes("MosharrofBubbleService.java"));
assert.ok(workflow.includes("OPEN_VOICE"));
assert.ok(page.includes('<script src="./voice-companion.js"></script>'));
console.log("MOSHARROF voice companion contract: PASS");
