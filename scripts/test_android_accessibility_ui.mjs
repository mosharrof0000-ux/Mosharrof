import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [ui, bridge, service, metadata, wrapper, installer, assetPrep] = await Promise.all([
  read("../core/android-accessibility-ui.js"),
  read("../native/android/AndroidAccessibilityPlugin.java"),
  read("../native/android/AgentAccessibilityService.java"),
  read("../native/android/agent_accessibility_service.xml"),
  read("./android/prepare-wrapper.sh"),
  read("./android/install-main-activity.sh"),
  read("./android/prepare-agent-web-assets.py")
]);

assert.match(ui, /getAccessibilityStatus/);
assert.match(ui, /inspectVisibleUi/);
assert.match(ui, /tapVisibleLabel/);
assert.match(ui, /scrollVisibleUi/);
assert.match(ui, /window\.confirm/);
assert.match(ui, /স্ক্রিনশট সার্ভারে পাঠানো হয়নি/);
assert.match(bridge, /AgentAccessibilityService\.isConnected/);
assert.match(bridge, /userMustEnableInSettings/);
assert.match(bridge, /result.put\("verified", false\)/);
assert.match(bridge, /public void getAccessibilityStatus/);
assert.match(bridge, /public void inspectVisibleUi/);
assert.match(bridge, /public void tapVisibleLabel/);
assert.match(bridge, /public void scrollVisibleUi/);
assert.match(service, /node\.isPassword\(\)/);
assert.match(service, /sensitive\(label\)/);
assert.match(service, /collectExactMatches/);
assert.match(service, /matches\.size\(\)\s*(?:===|==)\s*1/);
assert.match(service, /containsSensitiveNode\(root, 0\)/);
assert.ok(service.split("\n").length <= 250, "Accessibility service must remain under the native file-size limit");
assert.match(metadata, /canRetrieveWindowContent="true"/);
assert.match(assetPrep, /android-accessibility-ui\.js/);
assert.match(ui, /Plugins\.AndroidAccessibility/);
assert.match(installer, /registerPlugin\(AndroidAccessibilityPlugin\.class\)/);
assert.ok(installer.includes("cp native/android/AndroidAccessibilityPlugin.java"), "accessibility plugin must be packaged into APK");
console.log("Android Accessibility UI/native bridge contract: PASS");
