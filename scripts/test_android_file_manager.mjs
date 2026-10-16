import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const files = require("../core/android-file-manager.js");
const java = await readFile(new URL("../native/android/AndroidFileManagerPlugin.java", import.meta.url), "utf8");
const scanner = await readFile(new URL("../native/android/AndroidDuplicateScanner.java", import.meta.url), "utf8");
const organizer = await readFile(new URL("../native/android/AndroidMediaOrganizerPlugin.java", import.meta.url), "utf8");
const installer = await readFile(new URL("./android/install-main-activity.sh", import.meta.url), "utf8");
const wrapper = await readFile(new URL("./android/prepare-wrapper.sh", import.meta.url), "utf8");
const assetPrep = await readFile(new URL("./android/prepare-agent-web-assets.py", import.meta.url), "utf8");

for (const method of ["pickDirectory", "getSelectedDirectory", "listEntries", "createFolder",
  "createTextFile", "renameEntry", "deleteEntry", "moveEntry", "scanSelectedDirectoryDuplicates", "scanExactDuplicates"]) {
  assert.equal(typeof files[method], "function", "facade method missing: " + method);
}
await assert.rejects(() => files.createFolder("test"), /bridge unavailable/);
await assert.rejects(() => files.deleteEntry("document-id", false), /নিশ্চিতকরণ/);
await assert.rejects(() => files.moveEntry("source", "target", false), /নিশ্চিতকরণ/);
await assert.rejects(() => files.moveEntry("source", "target", true), /organizer bridge unavailable/);
for (const marker of ["ACTION_OPEN_DOCUMENT_TREE", "takePersistableUriPermission",
  "getSelectedDirectory(PluginCall call)", "confirmed", "safeName"]) {
  assert.ok(java.includes(marker), "native SAF contract missing: " + marker);
}
for (const marker of ["SHA-256", "MAX_FILES", "MAX_ENTRIES", "MAX_BYTES"]) {
  assert.ok(scanner.includes(marker), "bounded duplicate scanner contract missing: " + marker);
}
assert.ok(java.split("\n").length <= 250, "AndroidFileManagerPlugin must stay within the 250-line native-source budget");
assert.ok(scanner.split("\n").length <= 250, "AndroidDuplicateScanner must stay within the 250-line native-source budget");
assert.ok(organizer.split("\n").length <= 250, "AndroidMediaOrganizerPlugin must stay within the 250-line native-source budget");
for (const marker of ["DocumentsContract.moveDocument", "confirmed", "sourceParentId", "reversible"]) {
  assert.ok(organizer.includes(marker), "SAF media move contract missing: " + marker);
}
assert.ok(wrapper.includes("cp core/device-control.js android-web/device-control.js"));
assert.ok(assetPrep.includes('"android-file-manager.js"'));
assert.ok(assetPrep.includes('"android-file-manager-ui.js"'));
assert.ok(assetPrep.includes('<script src="./{script}"></script>') && assetPrep.includes("Android agent script injection incomplete"),
  "Android file-manager UI must be injected into the APK web entrypoint");
assert.ok(installer.includes("registerPlugin(AndroidFileManagerPlugin.class)"));
assert.ok(installer.includes("AndroidDuplicateScanner.java"), "scanner helper must be installed into APK");
assert.ok(installer.includes("AndroidMediaOrganizerPlugin.java"));
assert.ok(installer.includes("registerPlugin(AndroidMediaOrganizerPlugin.class)"));
assert.ok(!installer.includes("registerPlugin(MosharrofFilesPlugin.class)"),
  "duplicate plugin registration must be removed");

const bytesA = new TextEncoder().encode("same audio bytes").buffer;
const bytesB = new TextEncoder().encode("same audio bytes").buffer;
const bytesC = new TextEncoder().encode("different bytes").buffer;
const fake = (name, bytes) => ({ name, size: bytes.byteLength, type: "audio/mpeg",
  lastModified: 1, arrayBuffer: async () => bytes });
const scan = await files.scanExactDuplicates([
  fake("a.mp3", bytesA), fake("copy.mp3", bytesB), fake("other.mp3", bytesC)
]);
assert.equal(scan.scanned, 3);
assert.equal(scan.exactDuplicateGroups.length, 1);
assert.deepEqual(scan.exactDuplicateGroups[0].files.map(x => x.name), ["a.mp3", "copy.mp3"]);
assert.match(scan.note, /কোনো ফাইল মুছা হয়নি/);
console.log("Android SAF file-manager + exact duplicate scan contract: PASS");
