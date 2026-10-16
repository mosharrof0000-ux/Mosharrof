import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const plugin = readFileSync("native/android/FileManagerPlugin.java", "utf8");
const installer = readFileSync("scripts/android/install-main-activity.sh", "utf8");
const wrapper = readFileSync("scripts/android/prepare-wrapper.sh", "utf8");
const ui = readFileSync("core/android-file-manager-ui.js", "utf8");
const workflow = readFileSync(".github/workflows/build-apk.yml", "utf8");

for (const method of ["pickFolder", "getSelectedFolder", "listEntries", "createFolder", "createTextFile", "renameEntry", "deleteEntry", "scanDuplicates"]) {
  assert.ok(plugin.includes("void " + method + "("), "FileManager plugin missing " + method);
}
assert.ok(plugin.includes("ACTION_OPEN_DOCUMENT_TREE"), "folder access must use Android SAF picker");
assert.ok(plugin.includes("takePersistableUriPermission"), "selected folder permission must be persisted");
assert.ok(plugin.includes("MessageDigest.getInstance(\"SHA-256\")"), "duplicate scan must use content hashes");
assert.ok(plugin.includes("MAX_SCAN_FILES") && plugin.includes("MAX_HASH_BYTES"), "duplicate scan must have bounded resource limits");
assert.ok(plugin.includes("DocumentsContract.deleteDocument"), "delete must be explicit user-triggered native action");
assert.ok(installer.includes("FileManagerPlugin.class"), "native plugin must be registered");
assert.ok(wrapper.includes("core/device-control.js") && wrapper.includes("device-file-manager-ui.js"), "Android wrapper must package file manager UI");
assert.ok(ui.includes("scanDuplicates") && ui.includes("কোনো ফাইল মুছবে না"), "duplicate scan must be scan-only by default");
assert.ok(ui.includes("window.confirm"), "destructive action must require confirmation");
assert.ok(workflow.includes("test_android_file_manager_contract.mjs"), "APK workflow must run file manager contract test");
console.log("Android SAF file manager contract: PASS");
