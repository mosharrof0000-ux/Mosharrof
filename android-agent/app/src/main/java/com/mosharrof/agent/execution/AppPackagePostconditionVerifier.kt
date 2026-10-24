package com.mosharrof.agent.execution

/**
 * Maps Android's return code and independently observed package state to an honest terminal result.
 * Android's UI result alone is never treated as proof of installation or removal.
 */
object AppPackagePostconditionVerifier {
    fun install(
        pending: PendingAppPackageOperation,
        installedVersionCode: Long?,
        resultCodeOk: Boolean
    ): AppPackageTaskResult {
        require(pending.action == AppPackageTaskAction.INSTALL_APK)
        val expected = requireNotNull(pending.expectedVersionCode)
        val stateMatches = installedVersionCode == expected
        val unchangedExistingVersion = pending.initialVersionCode == expected
        if (stateMatches && (!unchangedExistingVersion || resultCodeOk)) {
            return AppPackageTaskResult(
                requestId = pending.requestId,
                action = pending.action,
                status = AppPackageTaskStatus.SUCCEEDED,
                detail = "ইনস্টল যাচাই সফল: প্যাকেজের ইনস্টল করা ভার্সন APK-এর ভার্সনের সঙ্গে মিলে গেছে।",
                packageName = pending.packageName,
                packageStateVerified = true
            )
        }
        val cancelled = !resultCodeOk
        return AppPackageTaskResult(
            requestId = pending.requestId,
            action = pending.action,
            status = if (cancelled) AppPackageTaskStatus.CANCELLED else AppPackageTaskStatus.FAILED,
            detail = if (cancelled) {
                "ইনস্টল নিশ্চিত হয়নি বা বাতিল হয়েছে; প্রত্যাশিত প্যাকেজ ভার্সন যাচাই করা যায়নি।"
            } else {
                "Android ইনস্টলার ফিরে এসেছে, কিন্তু প্রত্যাশিত প্যাকেজ ভার্সন ইনস্টল আছে বলে যাচাই করা যায়নি।"
            },
            packageName = pending.packageName
        )
    }

    fun uninstall(
        pending: PendingAppPackageOperation,
        packageStillInstalled: Boolean,
        resultCodeOk: Boolean
    ): AppPackageTaskResult {
        require(pending.action == AppPackageTaskAction.UNINSTALL_APP)
        if (!packageStillInstalled) {
            return AppPackageTaskResult(
                requestId = pending.requestId,
                action = pending.action,
                status = AppPackageTaskStatus.SUCCEEDED,
                detail = "আনইনস্টল যাচাই সফল: লক্ষ্য প্যাকেজটি আর ইনস্টল করা নেই।",
                packageName = pending.packageName,
                packageStateVerified = true
            )
        }
        val cancelled = !resultCodeOk
        return AppPackageTaskResult(
            requestId = pending.requestId,
            action = pending.action,
            status = if (cancelled) AppPackageTaskStatus.CANCELLED else AppPackageTaskStatus.FAILED,
            detail = if (cancelled) {
                "আনইনস্টল বাতিল হয়েছে; লক্ষ্য অ্যাপটি এখনো ইনস্টল আছে।"
            } else {
                "Android আনইনস্টল স্ক্রিন ফিরেছে, কিন্তু লক্ষ্য অ্যাপটি এখনো ইনস্টল আছে।"
            },
            packageName = pending.packageName
        )
    }
}
