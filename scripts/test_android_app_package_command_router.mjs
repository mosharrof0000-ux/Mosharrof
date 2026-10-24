import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createCommandRouter, parsePackageCommand } = require("../core/android-agent-command-router.js");

assert.deepEqual(parsePackageCommand("install app"), { kind: "pick-apk" });
assert.deepEqual(parsePackageCommand("অ্যাপ ইনস্টল করুন"), { kind: "pick-apk" });
assert.deepEqual(parsePackageCommand("install Chrome"), { kind: "search-store", query: "Chrome" });
assert.deepEqual(parsePackageCommand("অ্যাপ ইনস্টল করুন WhatsApp"), { kind: "search-store", query: "WhatsApp" });
assert.deepEqual(parsePackageCommand("uninstall WhatsApp"), { kind: "uninstall", target: "WhatsApp" });
assert.deepEqual(parsePackageCommand("uninstall app"), { kind: "uninstall", target: "" });
assert.equal(parsePackageCommand("How do I install Chrome?"), null, "questions should stay in normal chat");
assert.equal(parsePackageCommand("delete all my photos"), null, "unrelated destructive requests must not route to package plugin");

const calls = [];
const reports = [];
const plugin = {
  installAppFromPicker: async payload => {
    calls.push({ method: "installAppFromPicker", payload });
    return { requestId: payload.requestId, action: "INSTALL_APK", status: "SUCCEEDED", packageStateVerified: true, detail: "verified" };
  },
  searchPlayStore: async payload => {
    calls.push({ method: "searchPlayStore", payload });
    return { requestId: payload.requestId, action: "SEARCH_PLAY_STORE", status: "AWAITING_USER_CONFIRMATION", packageStateVerified: false, detail: "search only" };
  },
  uninstallApp: async payload => {
    calls.push({ method: "uninstallApp", payload });
    return { requestId: payload.requestId, action: "UNINSTALL_APP", status: "CANCELLED", packageStateVerified: false, detail: "cancelled" };
  }
};
const router = createCommandRouter({
  planner: null,
  executor: null,
  fileTaskRouter: null,
  getPlugin: () => plugin,
  confirm: () => true,
  prompt: () => "Chrome",
  report: message => reports.push(message)
});

const install = router.handle("install app");
assert.equal(install.handled, true);
const installResult = await install.promise;
assert.equal(installResult.status, "SUCCEEDED");
assert.equal(installResult.packageStateVerified, true);
assert.equal(calls[0].method, "installAppFromPicker");
assert.ok(calls[0].payload.requestId);
assert.match(reports.at(-1), /PASS/);

const storeSearch = router.handle("install Chrome");
assert.equal(storeSearch.handled, true);
const searchResult = await storeSearch.promise;
assert.equal(searchResult.status, "AWAITING_USER_CONFIRMATION");
assert.match(reports.at(-1), /ইনস্টল সফল হয়েছে বলে যাচাই করা হয়নি/);

const uninstall = router.handle("uninstall app");
assert.equal(uninstall.handled, true);
const uninstallResult = await uninstall.promise;
assert.equal(uninstallResult.status, "CANCELLED");
assert.equal(calls[2].method, "uninstallApp");
assert.equal(calls[2].payload.target, "Chrome");

let nativeCalls = 0;
const cancelledRouter = createCommandRouter({
  planner: null, executor: null, fileTaskRouter: null,
  getPlugin: () => ({ installAppFromPicker: async () => { nativeCalls += 1; } }),
  confirm: () => false, report: () => {}
});
const cancelled = await cancelledRouter.handle("install app").promise;
assert.equal(cancelled.status, "CANCELLED");
assert.equal(nativeCalls, 0, "web cancellation must prevent native operation");

const browserRouter = createCommandRouter({
  planner: null, executor: null, fileTaskRouter: null,
  getPlugin: () => null
});
assert.equal(browserRouter.handle("install app").handled, false,
  "plain browser/PWA must not pretend to control Android without the native plugin");

console.log("Android native app package command router contract: PASS");
