package com.mosharrof.agent.execution

import android.content.Context

/**
 * Small durable handoff point for the next chat/pairing bridge.
 * Stores only the latest task outcome; never stores APK bytes or device secrets.
 */
data class AppInstallExpectation(
    val expectedVersionCode: Long,
    val baselineVersionCode: Long?
)

object AppPackageTaskResultStore {
    private const val PREFS = "mosharrof_app_package_task_result"
    private const val KEY_REQUEST_ID = "request_id"
    private const val KEY_ACTION = "action"
    private const val KEY_STATUS = "status"
    private const val KEY_DETAIL = "detail"
    private const val KEY_PACKAGE_NAME = "package_name"
    private const val KEY_PACKAGE_VERIFIED = "package_state_verified"
    private const val KEY_EXPECTED_INSTALL_VERSION = "expected_install_version"
    private const val KEY_BASELINE_INSTALL_VERSION = "baseline_install_version"
    private const val KEY_HAS_BASELINE_INSTALL_VERSION = "has_baseline_install_version"

    fun save(context: Context, result: AppPackageTaskResult) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit()
            .putString(KEY_REQUEST_ID, result.requestId)
            .putString(KEY_ACTION, result.action.name)
            .putString(KEY_STATUS, result.status.name)
            .putString(KEY_DETAIL, result.detail)
            .putString(KEY_PACKAGE_NAME, result.packageName)
            .putBoolean(KEY_PACKAGE_VERIFIED, result.packageStateVerified)
            .apply()
        if (result.status != AppPackageTaskStatus.AWAITING_USER_CONFIRMATION) {
            prefs.edit()
                .remove(KEY_EXPECTED_INSTALL_VERSION)
                .remove(KEY_BASELINE_INSTALL_VERSION)
                .remove(KEY_HAS_BASELINE_INSTALL_VERSION)
                .apply()
        }
    }

    fun saveInstallExpectation(context: Context, expectedVersionCode: Long, baselineVersionCode: Long?) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putLong(KEY_EXPECTED_INSTALL_VERSION, expectedVersionCode)
            .putLong(KEY_BASELINE_INSTALL_VERSION, baselineVersionCode ?: -1L)
            .putBoolean(KEY_HAS_BASELINE_INSTALL_VERSION, baselineVersionCode != null)
            .apply()
    }

    fun installExpectation(context: Context): AppInstallExpectation? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.contains(KEY_EXPECTED_INSTALL_VERSION)) return null
        return AppInstallExpectation(
            expectedVersionCode = prefs.getLong(KEY_EXPECTED_INSTALL_VERSION, -1L).takeIf { it >= 0 } ?: return null,
            baselineVersionCode = if (prefs.getBoolean(KEY_HAS_BASELINE_INSTALL_VERSION, false)) {
                prefs.getLong(KEY_BASELINE_INSTALL_VERSION, -1L).takeIf { it >= 0 } ?: return null
            } else null
        )
    }

    fun latest(context: Context): AppPackageTaskResult? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val requestId = prefs.getString(KEY_REQUEST_ID, null) ?: return null
        val action = runCatching {
            AppPackageTaskAction.valueOf(prefs.getString(KEY_ACTION, null) ?: return null)
        }.getOrNull() ?: return null
        val status = runCatching {
            AppPackageTaskStatus.valueOf(prefs.getString(KEY_STATUS, null) ?: return null)
        }.getOrNull() ?: return null
        val detail = prefs.getString(KEY_DETAIL, null) ?: return null
        val packageName = prefs.getString(KEY_PACKAGE_NAME, null)
        val verified = prefs.getBoolean(KEY_PACKAGE_VERIFIED, false)
        return runCatching {
            AppPackageTaskResult(requestId, action, status, detail, packageName, verified)
        }.getOrNull()
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
