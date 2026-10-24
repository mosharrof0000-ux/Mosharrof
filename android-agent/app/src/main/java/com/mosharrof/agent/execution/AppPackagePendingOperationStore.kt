package com.mosharrof.agent.execution

import android.content.Context

/** Persists a pending system confirmation flow across activity recreation. */
object AppPackagePendingOperationStore {
    private const val PREFS = "mosharrof_pending_app_package_operation"
    private const val KEY_REQUEST_ID = "request_id"
    private const val KEY_ACTION = "action"
    private const val KEY_PACKAGE = "package_name"
    private const val KEY_BEFORE = "before_packages"
    private const val KEY_STARTED_AT = "started_at"
    private const val MAX_AGE_MILLIS = 30 * 60 * 1000L

    fun beginInstall(context: Context, requestId: String) = save(
        context, requestId, AppPackageTaskAction.INSTALL_APK, null,
        AppPackageStateVerifier.installedLauncherPackages(context)
    )

    fun beginUninstall(context: Context, requestId: String, packageName: String) = save(
        context, requestId, AppPackageTaskAction.UNINSTALL_APP, packageName,
        AppPackageStateVerifier.installedLauncherPackages(context)
    )

    private fun save(
        context: Context,
        requestId: String,
        action: AppPackageTaskAction,
        packageName: String?,
        before: Set<String>
    ) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_REQUEST_ID, requestId)
            .putString(KEY_ACTION, action.name)
            .putString(KEY_PACKAGE, packageName)
            .putStringSet(KEY_BEFORE, before)
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
        val before = prefs.getStringSet(KEY_BEFORE, emptySet())?.toSet() ?: emptySet()
        val startedAt = prefs.getLong(KEY_STARTED_AT, 0L)
        clear(context)
        if (startedAt <= 0L || System.currentTimeMillis() - startedAt > MAX_AGE_MILLIS) {
            return AppPackageTaskResult(
                requestId, action, AppPackageTaskStatus.TIMED_OUT,
                "Android confirmation flow-এর ফল ৩০ মিনিটের মধ্যে যাচাই করা যায়নি।",
                packageName
            )
        }
        return AppPackageStateVerifier.resolve(
            requestId, action, packageName, before,
            AppPackageStateVerifier.installedLauncherPackages(context)
        )
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
