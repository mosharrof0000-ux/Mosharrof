import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [ui, bridge, service, metadata, wrapper] = await Promise.all([
  read("../core/android-accessibility-ui.js"),
  read("../native/android/AndroidAccessibilityPlugin.java"),
  read("../native/android/AgentAccessibilityService.java"),
  read("../native/android/agent_accessibility_service.xml"),
  read("./android/prepare-wrapper.sh")
]);

assert.match(ui, /getAccessibilityStatus/);
assert.match(ui, /inspectVisibleUi/);
assert.match(ui, /tapVisibleLabel/);
assert.match(ui, /scrollVisibleUi/);
assert.match(ui, /window\.confirm/);
assert.match(ui, /স্ক্রিনশট সার্ভারে পাঠানো হয়নি/);
assert.match(bridge, /public void getAccessibilityStatus/);
assert.match(bridge, /public void inspectVisibleUi/);
assert.match(bridge, /public void tapVisibleLabel/);
assert.match(bridge, /public void scrollVisibleUi/);
assert.match(service, /node\.isPassword\(\)/);
assert.match(service, /sensitive\(label\)/);
assert.match(metadata, /canRetrieveWindowContent="true"/);
assert.match(wrapper, /cp core\/android-accessibility-ui\.js android-web\/android-accessibility-ui\.js/);
assert.match(wrapper, /android-accessibility-ui\.js/);
console.log("Android Accessibility UI/native bridge contract: PASS");
