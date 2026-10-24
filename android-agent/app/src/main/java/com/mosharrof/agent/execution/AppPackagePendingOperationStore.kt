package com.mosharrof.agent.execution

import android.content.Context
import android.content.pm.PackageManager

/** Persists the exact target/version for an Android confirmation flow across recreation. */
object AppPackagePendingOperationStore {
    private const val PREFS = "mosharrof_pending_app_package_operation"
    private const val KEY_REQUEST_ID = "request_id"
    private const val KEY_ACTION = "action"
    private const val KEY_PACKAGE = "package_name"
    private const val KEY_EXPECTED_VERSION = "expected_version_code"
    private const val KEY_PREVIOUS_VERSION = "previous_version_code"
    private const val KEY_HAS_PREVIOUS_VERSION = "has_previous_version"
    private const val KEY_STARTED_AT = "started_at"
    private const val MAX_AGE_MILLIS = 30 * 60 * 1000L

    fun beginInstall(
        context: Context,
        requestId: String,
        packageName: String,
        expectedVersionCode: Long,
        previousVersionCode: Long?
    ) = save(
        context, requestId, AppPackageTaskAction.INSTALL_APK, packageName,
        expectedVersionCode, previousVersionCode
    )

    fun beginUninstall(context: Context, requestId: String, packageName: String) = save(
        context, requestId, AppPackageTaskAction.UNINSTALL_APP, packageName, null, readInstalledVersion(context, packageName)?.versionCode
    )

    fun beginSearch(context: Context, requestId: String, query: String) = save(
        context, requestId, AppPackageTaskAction.SEARCH_PLAY_STORE, null, null, null
    )

    fun hasPendingRequest(context: Context, requestId: String): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return prefs.getString(KEY_REQUEST_ID, null) == requestId && prefs.getLong(KEY_STARTED_AT, 0L) > 0L
    }

    private fun save(
        context: Context,
        requestId: String,
        action: AppPackageTaskAction,
        packageName: String?,
        expectedVersionCode: Long?,
        previousVersionCode: Long?
    ) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_REQUEST_ID, requestId)
            .putString(KEY_ACTION, action.name)
            .putString(KEY_PACKAGE, packageName)
            .putLong(KEY_EXPECTED_VERSION, expectedVersionCode ?: -1L)
            .putLong(KEY_PREVIOUS_VERSION, previousVersionCode ?: -1L)
            .putBoolean(KEY_HAS_PREVIOUS_VERSION, previousVersionCode != null)
            .putLong(KEY_STARTED_AT, System.currentTimeMillis())
            .apply()
    }

    fun resolveAfterReturn(context: Context): AppPackageTaskResult? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val requestId = prefs.getString(KEY_REQUEST_ID, null) ?: return null
        val action = runCatching {
            AppPackageTaskAction.valueOf(prefs.getString(KEY_ACTION, null) ?: return null)
        }.getOrNull() ?: run { clear(context); return null }
        val packageName = prefs.getString(KEY_PACKAGE, null)
        val expectedVersion = prefs.getLong(KEY_EXPECTED_VERSION, -1L).takeIf { it >= 0L }
        val previousVersion = if (prefs.getBoolean(KEY_HAS_PREVIOUS_VERSION, false)) {
            prefs.getLong(KEY_PREVIOUS_VERSION, -1L).takeIf { it >= 0L }
        } else null
        val startedAt = prefs.getLong(KEY_STARTED_AT, 0L)
        clear(context)
        if (startedAt <= 0L || System.currentTimeMillis() - startedAt > MAX_AGE_MILLIS) {
            return AppPackageTaskResult(
                requestId, action, AppPackageTaskStatus.TIMED_OUT,
                "Android confirmation flow-এর ফল ৩০ মিনিটের মধ্যে যাচাই করা যায়নি।",
                packageName, expectedVersionCode = expectedVersion, previousVersionCode = previousVersion
            )
        }
        if (action == AppPackageTaskAction.SEARCH_PLAY_STORE) {
            return unknown(requestId, action, null, "Play Store সার্চ খোলা হয়েছিল; অ্যাপ ইনস্টল হয়েছে কি না এই ফল থেকে নিশ্চিত করা যায় না।")
        }
        if (packageName == null) return unknown(requestId, action, null, "যাচাইয়ের জন্য package name সংরক্ষিত ছিল না।")
        val installed = readInstalledVersion(context, packageName)
        return when (action) {
            AppPackageTaskAction.INSTALL_APK -> {
                val expected = expectedVersion ?: return unknown(requestId, action, packageName, "APK-এর version metadata পাওয়া যায়নি।")
                if (installed == null) {
                    unknown(requestId, action, packageName, "Android থেকে ফেরার পর package state পড়া যায়নি; ফল নিশ্চিত নয়。")
                } else {
                    AppPackageOutcomeVerifier.afterInstall(
                        requestId, packageName, expected, previousVersion,
                        installed.versionCode.takeIf { installed.isInstalled }
                    )
                }
            }
            AppPackageTaskAction.UNINSTALL_APP -> {
                if (installed == null) unknown(requestId, action, packageName, "Android থেকে ফেরার পর package state পড়া যায়নি; ফল নিশ্চিত নয়。")
                else AppPackageOutcomeVerifier.afterUninstall(requestId, packageName, installed.isInstalled)
            }
            AppPackageTaskAction.SEARCH_PLAY_STORE -> unknown(requestId, action, packageName, "Play Store খোলা ইনস্টল সফল হওয়ার প্রমাণ নয়।")
        }
    }

    private data class InstalledVersion(val isInstalled: Boolean, val versionCode: Long?)

    private fun readInstalledVersion(context: Context, packageName: String): InstalledVersion? = try {
        @Suppress("DEPRECATION")
        val info = context.packageManager.getPackageInfo(packageName, 0)
        InstalledVersion(true, if (android.os.Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong())
    } catch (_: PackageManager.NameNotFoundException) {
        InstalledVersion(false, null)
    } catch (_: Exception) {
        null
    }

    private fun unknown(
        requestId: String,
        action: AppPackageTaskAction,
        packageName: String?,
        detail: String
    ) = AppPackageTaskResult(
        requestId, action, AppPackageTaskStatus.UNKNOWN, detail, packageName
    )

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
