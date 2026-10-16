import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const java = readFileSync("native/android/DeviceControlPlugin.java", "utf8");
const ui = readFileSync("core/device-control.js", "utf8");
const pairs = {
  wifi:"openWifiSettings", bluetooth:"openBluetoothSettings", vpn:"openVpnSettings",
  nfc:"openNfcSettings", display:"openDisplaySettings", sound:"openSoundSettings",
  battery:"openBatterySettings", storage:"openStorageSettings",
  batteryOptimization:"openBatteryOptimizationSettings", location:"openLocationSettings",
  privacy:"openPrivacySettings", security:"openSecuritySettings",
  notifications:"openNotificationSettings", accessibility:"openAccessibilitySettings",
  overlay:"openOverlayPermissionSettings", appDetails:"openAppDetailsSettings",
  apps:"openAppSettings", defaultApps:"openDefaultAppsSettings", dateTime:"openDateTimeSettings",
  language:"openLanguageSettings", keyboard:"openKeyboardSettings", accounts:"openAccountsSettings"
};
for (const [action, method] of Object.entries(pairs)) {
  assert.ok(java.includes(method), `Native method missing: ${method}`);
  assert.ok(ui.includes('[["' + action + '"') || ui.includes(action + ':"'), `UI action missing: ${action}`);
}
assert.ok(java.includes("getDeviceInfo"));
assert.ok(java.includes("userMediated"));
assert.ok(!java.includes("WRITE_SETTINGS"));
assert.ok(!java.includes("AccessibilityService"));
assert.ok(ui.includes('data-device-action="'));
assert.ok(ui.includes("Android সেটিংস খুলবে"));
const composer = readFileSync("core/composer-enhancements.js", "utf8");
const stop = readFileSync("core/composer-stop.js", "utf8");
assert.ok(composer.includes("initializeComposerStopControl(send)"), "Chat organ does not initialize the stop control");
assert.ok(stop.includes('stop.id = "stopBtn"'), "Composer stop button is missing");
assert.ok(stop.includes("activeController.abort()"), "Stop action does not abort the active chat request");
assert.ok(stop.includes("মেসেজ থামানো হয়েছে"), "Cancellation should be reported without a generic connection failure");
const prep = readFileSync("scripts/prepare_web_organ_runtime.py", "utf8");
assert.ok(prep.includes('"web/composer-stop.js"') && prep.includes('"web/core/composer-stop.js"'), "Pages build must copy the stop helper beside both composer entrypoints");
assert.ok(ui.includes('data-device-action="selfTest"'), "Device-control self-test button is missing");
assert.ok(ui.includes("API সংযোগ মাত্র; ফোনে যাচাই নয়"), "Self-test must not claim physical device validation");
const comm = readFileSync("native/android/DeviceCommunicationPlugin.java", "utf8");
const commUi = readFileSync("core/device-communication-ui.js", "utf8");
assert.ok(["prepareCall","prepareSms","prepareEmail","Intent.ACTION_DIAL","Intent.ACTION_SENDTO"].every(x=>comm.includes(x))&&!comm.includes("Intent.ACTION_CALL"));
assert.ok(commUi.includes('data-device-action="prepareEmail"')&&commUi.includes("MosharrofDeviceCommunicationReady"));
assert.ok(readFileSync("scripts/android/install-main-activity.sh","utf8").includes("registerPlugin(DeviceCommunicationPlugin.class)"));
assert.ok(readFileSync("scripts/android/prepare-wrapper.sh","utf8").includes("device-communication-ui.js")&&readFileSync("scripts/prepare_web_organ_runtime.py","utf8").includes("device-communication-ui.js"));
console.log("Android device control and safe communication contract: PASS");
