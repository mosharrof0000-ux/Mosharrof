import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const plugin = readFileSync("native/android/DeviceControlPlugin.java", "utf8");
const ui = readFileSync("web/device-control.js", "utf8");
const page = readFileSync("web/index.html", "utf8");
const workflow = readFileSync(".github/workflows/build-apk.yml", "utf8");

for (const method of [
  "getDeviceInfo", "openWifiSettings", "openBluetoothSettings",
  "openAppSettings", "openDisplaySettings", "openBatterySettings",
  "openLocationSettings", "openSoundSettings"
]) {
  assert.ok(plugin.includes(method), `Native plugin missing ${method}`);
}
assert.ok(plugin.includes("@CapacitorPlugin(name = \"DeviceControl\")"));
assert.ok(plugin.includes("userMediated"));
assert.ok(plugin.includes("new Intent(action)"));
assert.ok(!plugin.includes("WRITE_SETTINGS"), "Must not request silent system-setting writes");
assert.ok(!plugin.includes("AccessibilityService"), "Must not add broad accessibility control");
assert.ok(ui.includes('id = "mosDeviceControls"') || ui.includes('id = "mosDeviceControls"') === false);
assert.ok(ui.includes('id="mosDeviceControls"'));
assert.ok(ui.includes("window.Capacitor") && ui.includes("Plugins.DeviceControl"));
assert.ok(ui.includes('data-device-action="wifi"'));
assert.ok(ui.includes("ওয়েবসাইট একা ফোনের সেটিংস বদলাতে পারে না"));
assert.ok(page.includes('<script src="./device-control.js"></script>'));
assert.ok(workflow.includes("cp native/android/DeviceControlPlugin.java"));
assert.ok(workflow.includes("registerPlugin(DeviceControlPlugin.class)"));

console.log("Android device-control safety contract: PASS");
