import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const plugin = readFileSync("native/android/UserFilesPlugin.java", "utf8");
const installer = readFileSync("scripts/android/install-main-activity.sh", "utf8");
const workflow = readFileSync(".github/workflows/build-apk.yml", "utf8");

for (const method of ["pickFolder", "listEntries", "createFolder", "createTextFile", "renameEntry", "deleteEntry"]) {
  assert.ok(plugin.includes("void " + method + "("), "SAF plugin missing " + method);
}
assert.ok(plugin.includes("Intent.ACTION_OPEN_DOCUMENT_TREE"), "must use Android's user-mediated folder picker");
assert.ok(plugin.includes("takePersistableUriPermission"), "must persist only user-selected folder permission");
assert.ok(plugin.includes("DocumentsContract.deleteDocument"), "must use SAF delete API");
assert.ok(plugin.includes('getBoolean("confirmed", false)'), "delete must require fresh explicit confirmation");
assert.ok(plugin.includes("getPersistedUriPermissions"), "must check current persisted permission");
assert.ok(plugin.includes("targetId.startsWith(treeId + \"/\")"), "must restrict operations to selected tree");
assert.ok(plugin.includes("DocumentsContract.createDocument"), "must use SAF document creation");
assert.ok(installer.includes("cp native/android/UserFilesPlugin.java android/app/src/main/java/com/mosharrof/ai/UserFilesPlugin.java"));
assert.ok(installer.includes("registerPlugin(UserFilesPlugin.class)"), "plugin must be registered in generated APK");
assert.ok(workflow.includes("node scripts/test_android_user_files_contract.mjs"), "APK workflow must run the SAF contract");
console.log("Android user-authorized SAF file operations contract: PASS");
