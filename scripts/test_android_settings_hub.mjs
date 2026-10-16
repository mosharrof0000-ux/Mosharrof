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
  assert.ok(ui.includes('["' + action + '"') || ui.includes(action + ':"'), `UI action missing: ${action}`);
}
assert.ok(java.includes("getDeviceInfo"));
assert.ok(java.includes("userMediated"));
assert.ok(!java.includes("WRITE_SETTINGS"));
assert.ok(!java.includes("AccessibilityService"));
assert.ok(ui.includes('data-device-action="'));
assert.ok(ui.includes("Android সেটিংস খুলবে"));
const composer = readFileSync("core/composer-enhancements.js", "utf8");
assert.ok(composer.includes('stop.id = "stopBtn"'), "Composer stop button is missing");
assert.ok(composer.includes("activeController.abort()"), "Stop action does not abort the active chat request");
assert.ok(composer.includes('url.includes("/chat")'), "Stop action must target the chat request");
assert.ok(composer.includes('text: "মেসেজ থামানো হয়েছে"'), "Cancellation should be reported without a generic connection failure");
console.log("Android settings hub and composer stop contract: PASS");
