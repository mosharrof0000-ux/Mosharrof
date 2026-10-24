package com.mosharrof.agent.execution

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build

/**
 * Durable local handoff point for the future authenticated chat/pairing bridge.
 * Stores only the latest task outcome and a package-version baseline; never APK bytes or secrets.
 */
object AppPackageTaskResultStore {
    private const val PREFS = "mosharrof_app_package_task_result"
    private const val KEY_REQUEST_ID = "request_id"
    private const val KEY_ACTION = "action"
    private const val KEY_STATUS = "status"
    private const val KEY_DETAIL = "detail"
    private const val KEY_PACKAGE_NAME = "package_name"
    private const val KEY_PACKAGE_VERIFIED = "package_state_verified"
    private const val KEY_BASELINE_VERSION = "baseline_version_code"
    private const val KEY_BASELINE_CAPTURED = "baseline_captured"
    private const val KEY_TARGET_VERSION = "verification_target_version_code"
    private const val UNKNOWN_VERSION = Long.MIN_VALUE

    fun save(context: Context, result: AppPackageTaskResult) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val edit = prefs.edit()
            .putString(KEY_REQUEST_ID, result.requestId)
            .putString(KEY_ACTION, result.action.name)
            .putString(KEY_STATUS, result.status.name)
            .putString(KEY_DETAIL, result.detail)
            .putString(KEY_PACKAGE_NAME, result.packageName)
            .putBoolean(KEY_PACKAGE_VERIFIED, result.packageStateVerified)

        // Uninstall has no APK metadata, so capture the installed baseline here.
        // Install captures both target and baseline before launching Android's installer.
        if (result.status == AppPackageTaskStatus.AWAITING_USER_CONFIRMATION &&
            result.action == AppPackageTaskAction.UNINSTALL_APP &&
            result.packageName != null
        ) {
            val baseline = packageVersionCode(context, result.packageName)
            edit.putBoolean(KEY_BASELINE_CAPTURED, true)
                .putLong(KEY_BASELINE_VERSION, baseline ?: UNKNOWN_VERSION)
        }
        edit.apply()
    }

    /**
     * Call only when the app resumes after Android's installer/uninstaller UI.
     * A changed package state may verify success; unchanged or unreadable state remains UNKNOWN.
     */
    fun reconcileAfterExternalConfirmation(context: Context): AppPackageTaskResult? {
        val pending = latest(context) ?: return null
        if (pending.status != AppPackageTaskStatus.AWAITING_USER_CONFIRMATION) return null
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val baseline = if (prefs.getBoolean(KEY_BASELINE_CAPTURED, false)) {
            prefs.getLong(KEY_BASELINE_VERSION, UNKNOWN_VERSION)
                .takeUnless { it == UNKNOWN_VERSION }
        } else null
        val current = pending.packageName?.let { packageVersionCode(context, it) }
        val reconciled = AppPackagePostcondition.reconcile(pending, baseline, current)
        save(context, reconciled)
        return reconciled
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


    fun saveVerificationTarget(context: Context, targetVersionCode: Long, baselineVersionCode: Long) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putLong(KEY_TARGET_VERSION, targetVersionCode)
            .putLong(KEY_BASELINE_VERSION, baselineVersionCode)
            .putBoolean(KEY_BASELINE_CAPTURED, true)
            .apply()
    }

    fun verificationTargetVersionCode(context: Context): Long? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return if (prefs.contains(KEY_TARGET_VERSION)) prefs.getLong(KEY_TARGET_VERSION, UNKNOWN_VERSION) else null
    }

    fun baselineVersionCode(context: Context): Long? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_BASELINE_CAPTURED, false)) return null
        return prefs.getLong(KEY_BASELINE_VERSION, UNKNOWN_VERSION).takeUnless { it == UNKNOWN_VERSION }
    }

    fun clearVerificationTarget(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .remove(KEY_TARGET_VERSION)
            .remove(KEY_BASELINE_VERSION)
            .remove(KEY_BASELINE_CAPTURED)
            .apply()
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }

    private fun packageVersionCode(context: Context, packageName: String): Long? = try {
        @Suppress("DEPRECATION")
        val info = context.packageManager.getPackageInfo(packageName, 0)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()
    } catch (_: PackageManager.NameNotFoundException) {
        null
    } catch (_: Exception) {
        UNKNOWN_VERSION
    }
}
