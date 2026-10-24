package com.mosharrof.agent.execution

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.widget.TextView
import java.util.UUID

/** Resolves an unambiguous installed app and delegates removal to Android's own UI. */
object AppPackageUninstallControl {
    private val PACKAGE_NAME = Regex("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+")

    fun resolveInstalledLauncherPackage(activity: Activity, query: String): String? {
        val normalized = query.trim()
        if (PACKAGE_NAME.matches(normalized)) {
            return if (isInstalled(activity, normalized)) normalized else null
        }
        val wanted = normalized.lowercase()
        return try {
            val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            @Suppress("DEPRECATION")
            activity.packageManager.queryIntentActivities(launcherIntent, 0)
                .filter { it.loadLabel(activity.packageManager).toString().trim().lowercase() == wanted }
                .map { it.activityInfo.packageName }
                .distinct()
                .singleOrNull()
        } catch (_: Exception) {
            null
        }
    }

    fun requestUninstall(
        activity: Activity,
        packageName: String,
        status: TextView,
        requestId: String = UUID.randomUUID().toString(),
        onTaskResult: (AppPackageTaskResult) -> Unit = {}
    ) {
        val normalized = packageName.trim()
        if (!PACKAGE_NAME.matches(normalized) || normalized == activity.packageName ||
            !isInstalled(activity, normalized)
        ) {
            val outcome = result(requestId, AppPackageTaskStatus.FAILED,
                "অ্যাপের package name ভুল, নিজের অ্যাপ, বা ইনস্টল করা অ্যাপের সঙ্গে মেলেনি; কিছু সরানো হয়নি।")
            onTaskResult(outcome)
            status.text = outcome.toDisplayText()
            return
        }

        AlertDialog.Builder(activity)
            .setTitle("অ্যাপ আনইনস্টল")
            .setMessage("$normalized অ্যাপটির Android আনইনস্টল স্ক্রিন খোলা হবে। চূড়ান্ত সিদ্ধান্ত সেখানে নিশ্চিত করতে হবে।")
            .setNegativeButton("বাতিল") { _, _ ->
                val outcome = result(requestId, AppPackageTaskStatus.CANCELLED,
                    "ব্যবহারকারী আনইনস্টল বাতিল করেছেন।", normalized)
                onTaskResult(outcome)
                status.text = outcome.toDisplayText()
            }
            .setPositiveButton("আনইনস্টল স্ক্রিন খুলুন") { _, _ ->
                try {
                    AppPackagePendingOperationStore.beginUninstall(activity, requestId, normalized)
                    activity.startActivity(Intent(Intent.ACTION_DELETE, Uri.parse("package:$normalized")))
                    val outcome = result(requestId, AppPackageTaskStatus.AWAITING_USER_CONFIRMATION,
                        "Android আনইনস্টল স্ক্রিন খোলা হয়েছে; ফিরে এলে প্যাকেজ আছে কি না যাচাই করা হবে।", normalized)
                    onTaskResult(outcome)
                    status.text = outcome.toDisplayText()
                } catch (_: Exception) {
                    AppPackagePendingOperationStore.clear(activity)
                    val outcome = result(requestId, AppPackageTaskStatus.FAILED,
                        "Android-এর আনইনস্টল স্ক্রিন খোলা যায়নি।", normalized)
                    onTaskResult(outcome)
                    status.text = outcome.toDisplayText()
                }
            }.show()
    }

    private fun isInstalled(activity: Activity, packageName: String): Boolean = try {
        @Suppress("DEPRECATION")
        activity.packageManager.getPackageInfo(packageName, 0)
        true
    } catch (_: Exception) {
        false
    }

    private fun result(
        requestId: String,
        taskStatus: AppPackageTaskStatus,
        detail: String,
        packageName: String? = null
    ) = AppPackageTaskResult(
        requestId = requestId,
        action = AppPackageTaskAction.UNINSTALL_APP,
        status = taskStatus,
        detail = detail,
        packageName = packageName
    )

    private fun AppPackageTaskResult.toDisplayText(): String =
        "কাজের ফল: $status • ID: $requestId\n$detail"
}
