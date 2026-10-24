package com.mosharrof.agent.execution

/**
 * Converts the state observed after Android's installer/uninstaller returns into an honest result.
 * A launch/return alone is never considered success.
 */
object AppPackageStateVerifier {
    fun evaluatePending(
        result: AppPackageTaskResult,
        installedVersionCode: Long?,
        expectedInstallVersionCode: Long? = null,
        baselineVersionCode: Long? = null
    ): AppPackageTaskResult? {
        if (result.status != AppPackageTaskStatus.AWAITING_USER_CONFIRMATION) return null
        val packageName = result.packageName ?: return null
        return when (result.action) {
            AppPackageTaskAction.INSTALL_APK -> {
                val expected = expectedInstallVersionCode
                when {
                    expected == null -> failed(result, "APK-এর প্রত্যাশিত সংস্করণ সংরক্ষিত নেই; ইনস্টল সফল বলে নিশ্চিত করা যায়নি।")
                    installedVersionCode == expected && baselineVersionCode != expected ->
                        result.copy(
                            status = AppPackageTaskStatus.SUCCEEDED,
                            detail = "Android থেকে ফিরে ইনস্টল করা প্যাকেজ ও সংস্করণ যাচাই হয়েছে।",
                            packageStateVerified = true
                        )
                    installedVersionCode == expected ->
                        failed(result, "প্যাকেজটি আগে থেকেই একই সংস্করণে ছিল; এই অনুরোধে ইনস্টল সম্পন্ন হয়েছে বলে নিশ্চিত করা যায়নি।")
                    installedVersionCode == null ->
                        failed(result, "Android ইনস্টলার থেকে ফেরার পর অ্যাপটি ইনস্টল অবস্থায় পাওয়া যায়নি।")
                    else ->
                        failed(result, "ইনস্টল করা সংস্করণ নির্বাচিত APK-এর সংস্করণের সঙ্গে মেলেনি।")
                }
            }
            AppPackageTaskAction.UNINSTALL_APP -> {
                if (installedVersionCode == null) {
                    result.copy(
                        status = AppPackageTaskStatus.SUCCEEDED,
                        detail = "Android থেকে ফিরে যাচাই করা হয়েছে যে অ্যাপটি আর ইনস্টল নেই।",
                        packageStateVerified = true
                    )
                } else {
                    failed(result, "Android আনইনস্টল স্ক্রিন থেকে ফেরার পরও অ্যাপটি ইনস্টল অবস্থায় আছে; আনইনস্টল নিশ্চিত নয়।")
                }
            }
            AppPackageTaskAction.SEARCH_PLAY_STORE -> null
        }
    }

    private fun failed(result: AppPackageTaskResult, detail: String) = result.copy(
        status = AppPackageTaskStatus.FAILED,
        detail = detail,
        packageStateVerified = false
    )
}
