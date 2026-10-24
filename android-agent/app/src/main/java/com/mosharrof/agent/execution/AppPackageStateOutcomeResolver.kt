package com.mosharrof.agent.execution

import android.app.Activity

/** Pure state-based resolver; a launched system screen is never sufficient evidence of success. */
object AppPackageStateOutcomeResolver {
    fun resolve(
        pending: PendingAppPackageOperation,
        resultCode: Int,
        installedVersionCode: Long?
    ): AppPackageTaskResult {
        return when (pending.action) {
            AppPackageTaskAction.INSTALL_APK -> {
                val expected = pending.expectedVersionCode
                val matches = expected != null && installedVersionCode == expected
                val stateChanged = !pending.wasInstalled || pending.previousVersionCode != installedVersionCode
                when {
                    matches && (resultCode == Activity.RESULT_OK || stateChanged) ->
                        result(pending, AppPackageTaskStatus.SUCCEEDED,
                            "ইনস্টল যাচাই সফল: ইনস্টল করা প্যাকেজের সংস্করণ নির্বাচিত APK-এর সঙ্গে মিলে গেছে।",
                            packageStateVerified = true)
                    resultCode == Activity.RESULT_CANCELED ->
                        result(pending, AppPackageTaskStatus.CANCELLED,
                            "Android ইনস্টল নিশ্চিত করেনি; কাজ বাতিল হয়েছে বা সম্পন্ন হয়নি।")
                    installedVersionCode == null ->
                        result(pending, AppPackageTaskStatus.FAILED,
                            "ফিরে আসার পর লক্ষ্য প্যাকেজ ইনস্টল পাওয়া যায়নি।")
                    else ->
                        result(pending, AppPackageTaskStatus.UNKNOWN,
                            "প্যাকেজের সংস্করণ নির্বাচিত APK-এর সঙ্গে মেলেনি; সফল বলে চিহ্নিত করা হয়নি।")
                }
            }
            AppPackageTaskAction.UNINSTALL_APP -> when {
                pending.wasInstalled && installedVersionCode == null ->
                    result(pending, AppPackageTaskStatus.SUCCEEDED,
                        "আনইনস্টল যাচাই সফল: লক্ষ্য প্যাকেজ আর ইনস্টল করা নেই।",
                        packageStateVerified = true)
                !pending.wasInstalled && installedVersionCode == null ->
                    result(pending, AppPackageTaskStatus.FAILED,
                        "আনইনস্টল শুরু করার আগে লক্ষ্য প্যাকেজ ইনস্টল ছিল বলে প্রমাণ নেই।")
                resultCode == Activity.RESULT_CANCELED ->
                    result(pending, AppPackageTaskStatus.CANCELLED,
                        "Android আনইনস্টল নিশ্চিত করেনি; অ্যাপটি এখনও ইনস্টল আছে।")
                else ->
                    result(pending, AppPackageTaskStatus.FAILED,
                        "আনইনস্টলের পরও লক্ষ্য প্যাকেজ ইনস্টল আছে।")
            }
            AppPackageTaskAction.SEARCH_PLAY_STORE ->
                result(pending, AppPackageTaskStatus.UNKNOWN,
                    "Play Store সার্চ থেকে ইনস্টল-অবস্থা যাচাই করা যায় না।")
        }
    }

    private fun result(
        pending: PendingAppPackageOperation,
        status: AppPackageTaskStatus,
        detail: String,
        packageStateVerified: Boolean = false
    ) = AppPackageTaskResult(
        requestId = pending.requestId,
        action = pending.action,
        status = status,
        detail = detail,
        packageName = pending.packageName,
        packageStateVerified = packageStateVerified
    )
}
