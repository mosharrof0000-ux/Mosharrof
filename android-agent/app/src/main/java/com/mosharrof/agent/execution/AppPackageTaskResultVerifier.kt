package com.mosharrof.agent.execution

/**
 * Converts a return from Android's installer/uninstaller into a verified result.
 * An unchanged package state is ambiguous (the user may have cancelled), so it is
 * never reported as a definite failure or success.
 */
object AppPackageTaskResultVerifier {
    fun afterConfirmation(result: AppPackageTaskResult, installed: Boolean?): AppPackageTaskResult {
        if (result.status != AppPackageTaskStatus.AWAITING_USER_CONFIRMATION) return result
        val packageName = result.packageName ?: return result
        if (result.action != AppPackageTaskAction.INSTALL_APK &&
            result.action != AppPackageTaskAction.UNINSTALL_APP
        ) return result

        if (installed == null) {
            return result.copy(
                status = AppPackageTaskStatus.UNKNOWN,
                detail = "Android স্ক্রিন থেকে ফেরা হয়েছে, কিন্তু প্যাকেজের অবস্থা পড়া যায়নি; ফল নিশ্চিত নয়।",
                packageStateVerified = false
            )
        }

        val expectedStateObserved = when (result.action) {
            AppPackageTaskAction.INSTALL_APK -> installed
            AppPackageTaskAction.UNINSTALL_APP -> !installed
            AppPackageTaskAction.SEARCH_PLAY_STORE -> false
        }
        return if (expectedStateObserved) {
            val actionText = if (result.action == AppPackageTaskAction.INSTALL_APK) "ইনস্টল" else "আনইনস্টল"
            result.copy(
                status = AppPackageTaskStatus.SUCCEEDED,
                detail = "প্যাকেজের অবস্থা যাচাই হয়েছে: $packageName — $actionText সম্পন্ন।",
                packageStateVerified = true
            )
        } else {
            result.copy(
                status = AppPackageTaskStatus.UNKNOWN,
                detail = "Android স্ক্রিন থেকে ফেরা হয়েছে, কিন্তু প্যাকেজের অবস্থা প্রত্যাশিত নয়; বাতিল নাকি ব্যর্থ তা নিশ্চিত করা যায়নি।",
                packageStateVerified = false
            )
        }
    }
}
