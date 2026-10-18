import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tile = readFileSync("scripts/android/install-voice-tile.sh", "utf8");
const main = readFileSync("scripts/android/install-main-activity.sh", "utf8");

assert.ok(tile.includes("new Intent(this, MainActivity.class)"), "Quick Settings tile must reuse MainActivity");
assert.ok(tile.includes('putExtra("mosharrof_start_chat_voice", true)'), "tile must request existing chat voice");
assert.ok(!tile.includes("new Intent(this, VoiceCommandActivity.class)"), "tile must not open the separate voice activity");
assert.ok(main.includes('getBooleanExtra("mosharrof_start_chat_voice", false)'), "MainActivity must accept the tile request");
assert.ok(main.includes("getElementById('composerVoiceBtn')"), "tile request must activate the existing composer microphone");
assert.ok(main.includes("deliverStartChatVoice(attempt + 1)"), "request must retry until the chat UI is ready");
console.log("Quick Settings main-chat voice contract: PASS");
