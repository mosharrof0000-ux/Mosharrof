import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const plugin = readFileSync("native/android/DeviceControlPlugin.java", "utf8");
const ui = readFileSync("core/device-control.js", "utf8");
const page = readFileSync("web/index.html", "utf8");
const workflow = readFileSync(".github/workflows/build-apk.yml", "utf8");
const wrapper = readFileSync("scripts/android/prepare-wrapper.sh", "utf8");
const assetPrep = readFileSync("scripts/android/prepare-agent-web-assets.py", "utf8");
const activity = readFileSync("scripts/android/install-main-activity.sh", "utf8");
const assets = readFileSync("scripts/prepare_web_organ_runtime.py", "utf8");

for (const method of [
  "getDeviceInfo", "openWifiSettings", "openBluetoothSettings",
  "openAppSettings", "openDisplaySettings", "openBatterySettings",
  "openLocationSettings", "openSoundSettings"
]) assert.ok(plugin.includes(method), `Native plugin missing ${method}`);
assert.ok(plugin.includes('@CapacitorPlugin(name = "DeviceControl")'));
assert.ok(plugin.includes("userMediated"));
assert.ok(!plugin.includes("WRITE_SETTINGS"), "Must not request silent system-setting writes");
assert.ok(ui.includes('section.id = "mosDeviceControls"'));
assert.ok(ui.includes("window.Capacitor") && ui.includes("Plugins.DeviceControl"));
assert.ok(ui.includes('data-device-action="wifi"'));
assert.ok(ui.includes("ওয়েবসাইট একা ফোনের সেটিংস বদলাতে পারে না"));
assert.ok(assets.includes('<script src="./device-control.js"></script>'));
assert.ok(assetPrep.includes('"device-control.js"'));
assert.ok(wrapper.includes("cp core/device-control.js android-web/device-control.js"));
assert.ok(activity.includes("cp native/android/DeviceControlPlugin.java"));
assert.ok(activity.includes("registerPlugin(DeviceControlPlugin.class)"));
assert.ok(assets.includes('"core/device-control.js": "web/device-control.js"'));
assert.ok(workflow.includes("scripts/android/test-agent-contracts.sh"));

console.log("Device-control safety: PASS");
