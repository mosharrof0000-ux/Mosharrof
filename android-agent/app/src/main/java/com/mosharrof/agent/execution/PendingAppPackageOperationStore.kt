package com.mosharrof.agent.execution

import android.content.Context

/** Persist only the minimal metadata needed to verify an Android-owned package confirmation. */
data class PendingAppPackageOperation(
    val requestId: String,
    val action: AppPackageTaskAction,
    val packageName: String,
    val expectedVersionCode: Long? = null,
    val wasInstalled: Boolean = false,
    val previousVersionCode: Long? = null
)

object PendingAppPackageOperationStore {
    private const val PREFS = "mosharrof_pending_app_package_operation"

    fun save(context: Context, pending: PendingAppPackageOperation) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("request_id", pending.requestId)
            .putString("action", pending.action.name)
            .putString("package_name", pending.packageName)
            .putString("expected_version_code", pending.expectedVersionCode?.toString())
            .putBoolean("was_installed", pending.wasInstalled)
            .putString("previous_version_code", pending.previousVersionCode?.toString())
            .commit()
    }

    fun latest(context: Context): PendingAppPackageOperation? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val requestId = prefs.getString("request_id", null) ?: return null
        val action = runCatching {
            AppPackageTaskAction.valueOf(prefs.getString("action", null) ?: return null)
        }.getOrNull() ?: return null
        val packageName = prefs.getString("package_name", null)?.takeIf { it.isNotBlank() } ?: return null
        return PendingAppPackageOperation(
            requestId = requestId,
            action = action,
            packageName = packageName,
            expectedVersionCode = prefs.getString("expected_version_code", null)?.toLongOrNull(),
            wasInstalled = prefs.getBoolean("was_installed", false),
            previousVersionCode = prefs.getString("previous_version_code", null)?.toLongOrNull()
        )
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().commit()
    }
}
