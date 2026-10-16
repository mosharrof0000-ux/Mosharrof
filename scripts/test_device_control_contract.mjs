import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const plugin = readFileSync("native/android/DeviceControlPlugin.java", "utf8");
const ui = readFileSync("core/device-control.js", "utf8");
const page = readFileSync("web/index.html", "utf8");
const workflow = readFileSync(".github/workflows/build-apk.yml", "utf8");
const wrapper = readFileSync("scripts/android/prepare-wrapper.sh", "utf8");
const activity = readFileSync("scripts/android/install-main-activity.sh", "utf8");
const assets = readFileSync("scripts/prepare_web_organ_runtime.py", "utf8");

const methods = [
  "getDeviceInfo", "openWifiSettings", "openBluetoothSettings", "openAppSettings",
  "openDisplaySettings", "openBatterySettings", "openLocationSettings", "openSoundSettings",
  "openSecuritySettings", "openPrivacySettings", "openNotificationSettings", "openStorageSettings",
  "openDateTimeSettings", "openLanguageSettings", "openKeyboardSettings", "openAccessibilitySettings",
  "openAccountsSettings", "openVpnSettings", "openNfcSettings", "openDefaultAppsSettings",
  "openAppDetailsSettings", "openOverlayPermissionSettings", "openBatteryOptimizationSettings"
];
for (const method of methods) assert.ok(plugin.includes(method), `Native plugin missing ${method}`);
for (const action of [
  "wifi", "bluetooth", "vpn", "nfc", "display", "sound", "battery", "storage",
  "batteryOptimization", "location", "privacy", "security", "notifications",
  "accessibility", "overlay", "appDetails", "apps", "defaultApps", "dateTime",
  "language", "keyboard", "accounts", "info"
]) assert.ok(ui.includes('"' + action + '":') || ui.includes('data-device-action="' + action + '"'), `UI missing action ${action}`);

assert.ok(plugin.includes('@CapacitorPlugin(name = "DeviceControl")'));
assert.ok(plugin.includes("userMediated"));
assert.ok(!plugin.includes("WRITE_SETTINGS"), "Must not request silent system-setting writes");
assert.ok(!plugin.includes("AccessibilityService"), "Must not add broad accessibility control");
assert.ok(ui.includes('section.id = "mosDeviceControls"'));
assert.ok(ui.includes("window.Capacitor") && ui.includes("Plugins.DeviceControl"));
assert.ok(ui.includes("সিস্টেম পরিবর্তনের আগে Android আপনার অনুমতি চাইতে পারে"));
assert.ok(ui.includes("ওয়েবসাইট একা ফোনের সিস্টেম সেটিংস নিয়ন্ত্রণ করতে পারে না"));
assert.ok(assets.includes('<script src="./device-control.js"></script>'));
assert.ok(wrapper.includes('<script src="./device-control.js"></script>'));
assert.ok(wrapper.includes("cp core/device-control.js android-web/device-control.js"));
assert.ok(activity.includes("cp native/android/DeviceControlPlugin.java"));
assert.ok(activity.includes("registerPlugin(DeviceControlPlugin.class)"));
assert.ok(assets.includes('"core/device-control.js": "web/device-control.js"'));
assert.ok(workflow.includes("node scripts/test_device_control_contract.mjs"));

console.log("Android settings hub safety contract: PASS");
