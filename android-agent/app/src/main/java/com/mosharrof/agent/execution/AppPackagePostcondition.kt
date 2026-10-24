package com.mosharrof.agent.execution

/**
 * Converts Android package state observed after returning from the OS-owned confirmation UI
 * into a conservative task result. Dispatching an intent is never treated as success.
 */
object AppPackagePostcondition {
    private const val UNKNOWN_VERSION = Long.MIN_VALUE
    fun reconcile(
        pending: AppPackageTaskResult,
        baselineVersionCode: Long?,
        currentVersionCode: Long?,
        targetVersionCode: Long? = null
    ): AppPackageTaskResult {
        require(pending.status == AppPackageTaskStatus.AWAITING_USER_CONFIRMATION) {
            "Only pending confirmation results can be reconciled"
        }
        val packageName = pending.packageName
        return when (pending.action) {
            AppPackageTaskAction.INSTALL_APK -> {
                val installedOrUpdated = currentVersionCode != null && currentVersionCode != UNKNOWN_VERSION &&
                    if (targetVersionCode != null) {
                        currentVersionCode == targetVersionCode &&
                            baselineVersionCode != null &&
                            currentVersionCode != baselineVersionCode
                    } else {
                        baselineVersionCode == -1L ||
                            (baselineVersionCode != null && currentVersionCode > baselineVersionCode)
                    }
                if (packageName != null && installedOrUpdated) {
                    AppPackageTaskResult(
                        requestId = pending.requestId,
                        action = pending.action,
                        status = AppPackageTaskStatus.SUCCEEDED,
                        detail = "Android থেকে ফিরে প্যাকেজের ইনস্টল/আপডেট অবস্থা যাচাই করা হয়েছে।",
                        packageName = packageName,
                        packageStateVerified = true
                    )
                } else {
                    unknown(pending, "ইনস্টলার থেকে ফেরার পর ইনস্টল নিশ্চিত করার মতো প্যাকেজ-অবস্থা পাওয়া যায়নি।")
                }
            }
            AppPackageTaskAction.UNINSTALL_APP -> {
                if (packageName != null && currentVersionCode == null) {
                    AppPackageTaskResult(
                        requestId = pending.requestId,
                        action = pending.action,
                        status = AppPackageTaskStatus.SUCCEEDED,
                        detail = "Android থেকে ফিরে যাচাই করা হয়েছে যে অ্যাপটি আর ইনস্টল নেই।",
                        packageName = packageName,
                        packageStateVerified = true
                    )
                } else if (currentVersionCode == UNKNOWN_VERSION) {
                    unknown(pending, "অ্যাপের ইনস্টল অবস্থা পড়া যায়নি; আনইনস্টল সফল বলা যাচ্ছে না।")
                } else {
                    unknown(pending, "ফেরার পর অ্যাপটি এখনো ইনস্টল আছে; বাতিল ও ব্যর্থতার মধ্যে নির্ভরযোগ্য পার্থক্য করা যায়নি।")
                }
            }
            AppPackageTaskAction.SEARCH_PLAY_STORE ->
                unknown(pending, "Play Store খোলা ইনস্টল হওয়ার প্রমাণ নয়; এই অনুরোধ থেকে ইনস্টল ফল যাচাই করা যায়নি।")
        }
    }

    private fun unknown(pending: AppPackageTaskResult, detail: String) =
        AppPackageTaskResult(
            requestId = pending.requestId,
            action = pending.action,
            status = AppPackageTaskStatus.UNKNOWN,
            detail = detail,
            packageName = pending.packageName,
            packageStateVerified = false
        )
}
