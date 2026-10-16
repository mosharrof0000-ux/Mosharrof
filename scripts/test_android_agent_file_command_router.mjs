import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createCommandRouter } = require("../core/android-agent-command-router.js");
const taskPlanner = require("../core/android-agent-task-planner.js");
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
const router = createCommandRouter({ taskPlanner, confirm: () => true, report: text => { reported = text; } });
let result = router.handle("ফাইলের তালিকা দেখাও");
assert.equal(result.handled, true);
await result.promise;
assert.match(reported, /ছবি\.png/);
assert.match(reported, /নথি/);
result = router.handle("ডুপ্লিকেট গান খুঁজে দেখাও");
assert.equal(result.handled, true);
await result.promise;
assert.match(reported, /1টি ডুপ্লিকেট গ্রুপ/);
assert.match(reported, /কোনো ফাইল মুছবে না/);
delete globalThis.MosharrofFiles;
console.log("Android agent file command router: PASS");
