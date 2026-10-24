package com.mosharrof.agent.execution

import android.content.Context
import android.content.pm.PackageManager

/**
 * Verifies the package state after Android's installer/uninstaller returns.
 * A launch or a result code alone is never treated as successful installation/removal.
 */
object AppPackageOutcomeVerifier {
    fun verifyAfterReturn(context: Context, pending: AppPackageTaskResult): AppPackageTaskResult? {
        if (pending.status != AppPackageTaskStatus.AWAITING_USER_CONFIRMATION) return null
        if (pending.action != AppPackageTaskAction.INSTALL_APK &&
            pending.action != AppPackageTaskAction.UNINSTALL_APP) return null
        val packageName = pending.packageName ?: return null

        val installedAfter = isInstalled(context, packageName)
        if (installedAfter == null) {
            return pending.copy(
                status = AppPackageTaskStatus.UNKNOWN,
                detail = "Android স্ক্রিন থেকে ফেরার পর package state পড়া যায়নি; সফলতা নিশ্চিত নয়।",
                packageStateVerified = false
            )
        }

        val outcome = when (pending.action) {
            AppPackageTaskAction.INSTALL_APK -> {
                val installedBefore = AppPackageTaskResultStore.wasInstalledBefore(context)
                when {
                    installedAfter && !installedBefore -> pending.copy(
                        status = AppPackageTaskStatus.SUCCEEDED,
                        detail = "ইনস্টল যাচাই সফল: Android থেকে ফেরার পর অ্যাপটি ইনস্টল করা অবস্থায় পাওয়া গেছে।",
                        packageStateVerified = true
                    )
                    installedAfter -> pending.copy(
                        status = AppPackageTaskStatus.UNKNOWN,
                        detail = "অ্যাপটি ইনস্টল আছে, কিন্তু কাজের আগে থেকেই ছিল; এই অনুরোধে নতুন ইনস্টল হয়েছে বলে নিশ্চিত করা যায়নি।",
                        packageStateVerified = true
                    )
                    else -> pending.copy(
                        status = AppPackageTaskStatus.UNKNOWN,
                        detail = "Android থেকে ফেরার পর অ্যাপটি ইনস্টল পাওয়া যায়নি; বাতিল ও ইনস্টল-ব্যর্থতার মধ্যে পার্থক্য নিশ্চিত নয়।",
                        packageStateVerified = true
                    )
                }
            }
            AppPackageTaskAction.UNINSTALL_APP -> {
                if (!installedAfter) pending.copy(
                    status = AppPackageTaskStatus.SUCCEEDED,
                    detail = "আনইনস্টল যাচাই সফল: Android থেকে ফেরার পর অ্যাপটি আর ইনস্টল পাওয়া যায়নি।",
                    packageStateVerified = true
                ) else pending.copy(
                    status = AppPackageTaskStatus.CANCELLED,
                    detail = "অ্যাপটি এখনো ইনস্টল আছে; আনইনস্টল সম্পন্ন হয়নি।",
                    packageStateVerified = true
                )
            }
            AppPackageTaskAction.SEARCH_PLAY_STORE -> return null
        }
        AppPackageTaskResultStore.clearPreOperationState(context)
        return outcome
    }

    private fun isInstalled(context: Context, packageName: String): Boolean? = try {
        @Suppress("DEPRECATION")
        context.packageManager.getApplicationInfo(packageName, 0)
        true
    } catch (_: PackageManager.NameNotFoundException) {
        false
    } catch (_: SecurityException) {
        null
    } catch (_: Exception) {
        null
    }
}
