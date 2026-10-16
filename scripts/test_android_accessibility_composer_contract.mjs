import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ui = readFileSync("core/device-control.js", "utf8");
const accessibility = readFileSync("native/android/AgentAccessibilityService.java", "utf8");
const accessibilityInstaller = readFileSync("scripts/android/install-agent-accessibility.sh", "utf8");
assert.ok(accessibility.includes("node.isPassword()"), "Accessibility inspection must exclude password fields");
assert.ok(accessibility.includes("ACTION_CLICK"), "Accessibility tap capability is missing");
assert.ok(accessibility.includes("ACTION_SCROLL_FORWARD"), "Accessibility scroll capability is missing");
assert.ok(accessibilityInstaller.includes("BIND_ACCESSIBILITY_SERVICE"), "Service must use Android's protected service binding");
assert.ok(accessibility.includes("AgentAccessibilityService.isConnected()") || readFileSync("native/android/AndroidAccessibilityPlugin.java", "utf8").includes("AgentAccessibilityService.isConnected()"), "Accessibility actions must require the explicitly enabled service");
assert.ok(ui.includes("ফাইল অপারেশন বাস্তব ডিভাইসে এখনও পরীক্ষা হয়নি"), "Self-test must clearly state physical file operations remain untested");

const composer = readFileSync("core/composer-enhancements.js", "utf8");
const stop = readFileSync("core/composer-stop.js", "utf8");
assert.ok(composer.includes("initializeComposerStopControl(send)"), "Chat organ does not initialize the stop control");
assert.ok(stop.includes('stop.id = "stopBtn"'), "Composer stop button is missing");
assert.ok(stop.includes("activeController.abort()"), "Stop action does not abort the active chat request");
assert.ok(stop.includes('url.includes("/chat")'), "Stop action must target the chat request");
assert.ok(stop.includes("মেসেজ থামানো হয়েছে"), "Cancellation should be reported without a generic connection failure");
const prep = readFileSync("scripts/prepare_web_organ_runtime.py", "utf8");
assert.ok(prep.includes('"web/composer-stop.js"') && prep.includes('"web/core/composer-stop.js"'), "Pages build must copy the stop helper beside both composer entrypoints");
console.log("Android accessibility and composer stop contract: PASS");
