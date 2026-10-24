import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const plugin = readFileSync("native/android/AppPackagePlugin.java", "utf8");
const platform = readFileSync("native/android/AppPackagePlatform.java", "utf8");
const pending = readFileSync("native/android/AppPackagePendingStore.java", "utf8");
const installer = readFileSync("scripts/android/install-app-package-plugin.sh", "utf8");
const activity = readFileSync("scripts/android/install-main-activity.sh", "utf8");
const router = readFileSync("core/android-agent-command-router.js", "utf8");
const packageRouter = readFileSync("core/android-app-package-command-router.js", "utf8");
const contracts = readFileSync("scripts/android/test-agent-contracts.sh", "utf8");

assert.ok(plugin.includes('@CapacitorPlugin(name = "AppPackage")'));
assert.ok(plugin.includes('startActivityForResult(call, picker, "apkPickerResult")'));
assert.ok(plugin.includes('startActivityForResult(call, install, "installResult")'));
assert.ok(plugin.includes('startActivityForResult(call, new Intent(Intent.ACTION_DELETE'));
assert.ok(plugin.includes('resolve(call, pending.requestId, "INSTALL_APK", "SUCCEEDED"'));
assert.ok(plugin.includes('resolve(call, pending.requestId, "UNINSTALL_APP", "SUCCEEDED"'));
assert.ok(plugin.includes('"packageStateVerified", packageStateVerified'));
assert.ok(plugin.includes('"SUCCEEDED".equals(status) && !packageStateVerified'),
  "success must be downgraded unless native package state was verified");

assert.ok(platform.includes("getPackageArchiveInfo"));
assert.ok(platform.includes("MAX_APK_BYTES = 512L * 1024L * 1024L"));
assert.ok(platform.includes("queryIntentActivities"));
assert.ok(platform.includes("NameNotFoundException"));
assert.ok(pending.includes("request_id") && pending.includes("expected_version"));

assert.ok(installer.includes("REQUEST_INSTALL_PACKAGES"));
assert.ok(installer.includes("android.intent.category.LAUNCHER"));
assert.ok(activity.includes("bash scripts/android/install-app-package-plugin.sh"));
assert.ok(activity.includes("registerPlugin(AppPackagePlugin.class)"));

assert.ok(router.includes("MosharrofAndroidAppPackageCommandRouter"));
assert.ok(packageRouter.includes("parsePackageCommand"));
assert.ok(packageRouter.includes("installAppFromPicker"));
assert.ok(packageRouter.includes("searchPlayStore"));
assert.ok(packageRouter.includes("uninstallApp"));
assert.ok(router.includes("result.packageStateVerified === true"),
  "chat UI must not announce success without verified package state");
assert.ok(contracts.includes("scripts/test_android_app_package_command_router.mjs"));
assert.ok(contracts.includes("scripts/test_android_app_package_plugin_contract.mjs"));

console.log("Native app package install/uninstall safety contract: PASS");
