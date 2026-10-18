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
assert.ok(ui.includes('data-device-action="'));
assert.ok(ui.includes("Android সেটিংস খুলবে"));
console.log("Android settings hub, diagnostics and composer stop contract: PASS");
