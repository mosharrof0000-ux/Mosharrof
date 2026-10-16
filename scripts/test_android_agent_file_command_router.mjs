import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { createFileCommandRouter } = require("../core/android-agent-file-command-router.js");
const mainRouter = readFileSync("core/android-agent-command-router.js", "utf8");
assert.ok(mainRouter.includes("MosharrofAndroidFileCommandRouter"));
const taskPlanner = require("../core/android-agent-task-planner.js");
const assets = readFileSync("scripts/android/prepare-agent-web-assets.py", "utf8");
assert.ok(assets.includes('"android-agent-task-planner.js"'));
assert.ok(assets.indexOf("android-agent-file-command-router.js") < assets.indexOf("android-agent-command-router.js"));
let reported = "";
globalThis.MosharrofFiles = {
  async getSelectedDirectory() { return { selected: true, documentId: "root" }; },
  async listEntries() { return { count: 2, items: [
    { name: "ছবি.png", isDirectory: false }, { name: "নথি", isDirectory: true }
  ] }; },
  async scanSelectedDirectoryDuplicates() { return { filesScanned: 3, groups: [
    { files: [{ name: "a.mp3" }, { name: "copy.mp3" }] }
  ], truncated: false }; }
};
const router = createFileCommandRouter({ taskPlanner, confirm: () => true, report: text => { reported = text; } });
let result = router.handle("ফাইলের তালিকা দেখাও");
assert.equal(result.handled, true);
await result.promise;
assert.match(reported, /ছবি\.png/);
assert.match(reported, /নথি/);
result = router.handle("ডুপ্লিকেট গান খুঁজে দেখাও");
assert.equal(result.handled, true);
await result.promise;
assert.match(reported, /1টি ডুপ্লিকেট গ্রুপ/);
assert.match(reported, /কোনো ফাইল মুছেনি/);
delete globalThis.MosharrofFiles;
console.log("Android agent file command router: PASS");
