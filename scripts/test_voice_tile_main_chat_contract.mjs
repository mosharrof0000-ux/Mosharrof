import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tile = readFileSync("scripts/android/install-voice-tile.sh", "utf8");
const main = readFileSync("scripts/android/install-main-activity.sh", "utf8");
const overlay = readFileSync("scripts/android/install-voice-overlay.sh", "utf8");
const plugin = readFileSync("native/android/FloatingChatPlugin.java", "utf8");

assert.ok(tile.includes("new Intent(this, MainActivity.class)"), "Quick Settings tile must reuse MainActivity");
assert.ok(tile.includes('putExtra("mosharrof_start_chat_voice", true)'), "tile must request existing chat voice");
assert.ok(!tile.includes("new Intent(this, VoiceCommandActivity.class)"), "tile must not open the separate voice activity");
assert.ok(main.includes('getBooleanExtra("mosharrof_start_chat_voice", false)'), "MainActivity must accept the tile request");
assert.ok(main.includes("getElementById('composerVoiceBtn')"), "tile request must activate the existing composer microphone");
assert.ok(main.includes("deliverStartChatVoice(attempt + 1)"), "request must retry until the chat UI is ready");
assert.ok(main.includes("cp native/android/FloatingChatPlugin.java"), "PiP plugin must be included in APK generation");
assert.ok(main.includes("registerPlugin(FloatingChatPlugin.class)"), "PiP plugin must be registered with Capacitor");
assert.ok(overlay.includes("android:supportsPictureInPicture"), "MainActivity must opt in to Android PiP");
assert.ok(plugin.includes("enterPictureInPictureMode(params)"), "native bridge must enter PiP on the existing activity");
console.log("Quick Settings main-chat voice + native PiP contract: PASS");
