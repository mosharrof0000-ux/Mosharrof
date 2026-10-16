import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createCommandRouter } = require("../core/android-agent-command-router.js");
const { planCommand } = require("../core/android-agent-planner.js");
const { createExecutor } = require("../core/android-agent-executor.js");
const fs = await import("node:fs/promises");
const wrapper = await fs.readFile(new URL("./android/prepare-wrapper.sh", import.meta.url), "utf8");
const assets = await fs.readFile(new URL("./android/prepare-agent-web-assets.py", import.meta.url), "utf8");
const bridge = await fs.readFile(new URL("./android/inject-android-voice-bridge.py", import.meta.url), "utf8");

assert.ok(wrapper.includes("prepare-agent-web-assets.py"));
assert.ok(assets.includes('"android-agent-command-router.js"'));
assert.ok(bridge.includes("routeAndroidAgentCommand"));
assert.ok(bridge.includes("attempt < 20"), "native voice bridge must wait briefly for agent scripts on first launch");
assert.ok(bridge.includes("sendBtn.addEventListener(\"click\""));
assert.ok(assets.includes('"android-agent-memory.js"'));
let calls = 0;
let confirmationText = "";
const router = createCommandRouter({
  planner: { planCommand },
  executor: { createExecutor },
  getPlugin: () => ({
    openWifiSettings: async () => {
      calls += 1;
      return { opened: true, action: "android.settings.WIFI_SETTINGS" };
    }
  }),
  confirm: message => { confirmationText = message; return true; },
  report: () => {}
});
const supported = router.handle("ওয়াই-ফাই সেটিংস খোলো");
assert.equal(supported.handled, true);
assert.match(confirmationText, /শুধু Android সেটিংস খোলা হবে/);
const completed = await supported.promise;
assert.equal(completed.status, "completed");
assert.equal(calls, 1);
assert.equal(completed.steps[0].status, "verified");

const unsupported = router.handle("আমার ছবিগুলো তারিখ অনুযায়ী সাজাও");
assert.equal(unsupported.handled, false);
assert.equal(calls, 1, "unsupported commands must never invoke a native action");

const sensitive = router.handle("পাসওয়ার্ড লিখে দাও");
assert.equal(sensitive.handled, false);
assert.equal(calls, 1, "sensitive commands must not invoke a native action");

const cancelledRouter = createCommandRouter({
  planner: { planCommand }, executor: { createExecutor },
  getPlugin: () => ({ openWifiSettings: async () => { calls += 1; return { opened: true }; } }),
  confirm: () => false, report: () => {}
});
const cancelled = await cancelledRouter.handle("Wi-Fi সেটিংস খোলো").promise;
assert.equal(cancelled.status, "cancelled");
assert.equal(calls, 1, "cancelled preview must not invoke a native action");

console.log("Android agent command router contract: PASS");
