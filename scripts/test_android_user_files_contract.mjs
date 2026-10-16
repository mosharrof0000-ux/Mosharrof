import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const plugin = readFileSync("native/android/UserFilesPlugin.java", "utf8");
const installer = readFileSync("scripts/android/install-main-activity.sh", "utf8");
const workflow = readFileSync(".github/workflows/build-apk.yml", "utf8");
const ui = readFileSync("core/android-user-files.js", "utf8");
const wrapper = readFileSync("scripts/android/prepare-wrapper.sh", "utf8");

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
assert.ok(ui.includes("ফোল্ডার নির্বাচন") && ui.includes("তালিকা দেখুন"), "Android UI must expose folder selection and listing");
assert.ok(ui.includes("p.deleteEntry") && ui.includes("window.confirm"), "UI must confirm deletion before invoking native delete");
assert.ok(wrapper.includes("cp core/android-user-files.js android-web/android-user-files.js"), "Android UI must be bundled");
assert.ok(wrapper.includes('<script src="./android-user-files.js"></script>'), "Android UI script must be injected");
console.log("Android user-authorized SAF file operations contract: PASS");
