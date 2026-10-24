package com.mosharrof.agent.execution

import android.content.Context

/**
 * Small durable handoff point for the next chat/pairing bridge.
 * Stores only the latest task outcome; never stores APK bytes or device secrets.
 */
object AppPackageTaskResultStore {
    private const val PREFS = "mosharrof_app_package_task_result"
    private const val KEY_REQUEST_ID = "request_id"
    private const val KEY_ACTION = "action"
    private const val KEY_STATUS = "status"
    private const val KEY_DETAIL = "detail"
    private const val KEY_PACKAGE_NAME = "package_name"
    private const val KEY_PACKAGE_VERIFIED = "package_state_verified"
    private const val KEY_PENDING_REQUEST_ID = "pending_request_id"
    private const val KEY_PENDING_ACTION = "pending_action"
    private const val KEY_PENDING_PACKAGE_NAME = "pending_package_name"
    private const val KEY_PENDING_EXPECTED_VERSION = "pending_expected_version"

    fun save(context: Context, result: AppPackageTaskResult) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_REQUEST_ID, result.requestId)
            .putString(KEY_ACTION, result.action.name)
            .putString(KEY_STATUS, result.status.name)
            .putString(KEY_DETAIL, result.detail)
            .putString(KEY_PACKAGE_NAME, result.packageName)
            .putBoolean(KEY_PACKAGE_VERIFIED, result.packageStateVerified)
            .apply()
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

    fun savePending(context: Context, pending: PendingAppPackageOperation) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_PENDING_REQUEST_ID, pending.requestId)
            .putString(KEY_PENDING_ACTION, pending.action.name)
            .putString(KEY_PENDING_PACKAGE_NAME, pending.packageName)
            .putLong(KEY_PENDING_EXPECTED_VERSION, pending.expectedVersionCode ?: -1L)
            .apply()
    }

    fun pending(context: Context): PendingAppPackageOperation? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val requestId = prefs.getString(KEY_PENDING_REQUEST_ID, null) ?: return null
        val action = runCatching { AppPackageTaskAction.valueOf(prefs.getString(KEY_PENDING_ACTION, null) ?: return null) }.getOrNull() ?: return null
        val packageName = prefs.getString(KEY_PENDING_PACKAGE_NAME, null) ?: return null
        val expected = prefs.getLong(KEY_PENDING_EXPECTED_VERSION, -1L).takeIf { it >= 0L }
        return runCatching { PendingAppPackageOperation(requestId, action, packageName, expected) }.getOrNull()
    }

    fun clearPending(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .remove(KEY_PENDING_REQUEST_ID)
            .remove(KEY_PENDING_ACTION)
            .remove(KEY_PENDING_PACKAGE_NAME)
            .remove(KEY_PENDING_EXPECTED_VERSION)
            .apply()
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
