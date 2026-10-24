package com.mosharrof.agent.execution

import android.content.Context
import android.content.Intent

/** Verifies package changes after the user returns from Android's installer/uninstaller. */
object AppPackageStateVerifier {
    fun installedLauncherPackages(context: Context): Set<String> = runCatching {
        val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        @Suppress("DEPRECATION")
        context.packageManager.queryIntentActivities(launcherIntent, 0)
            .map { it.activityInfo.packageName }
            .toSet()
    }.getOrDefault(emptySet())

    fun resolve(
        requestId: String,
        action: AppPackageTaskAction,
        packageName: String?,
        before: Set<String>,
        after: Set<String>
    ): AppPackageTaskResult = when (action) {
        AppPackageTaskAction.INSTALL_APK -> {
            val added = after - before
            if (added.size == 1) {
                val installed = added.single()
                AppPackageTaskResult(
                    requestId, action, AppPackageTaskStatus.SUCCEEDED,
                    "Android থেকে ফেরার পর নতুন প্যাকেজের উপস্থিতি যাচাই করা হয়েছে।",
                    installed, packageStateVerified = true
                )
            } else {
                AppPackageTaskResult(
                    requestId, action, AppPackageTaskStatus.UNKNOWN,
                    "ফেরার পর ঠিক একটি নতুন launcher package নিশ্চিত করা যায়নি; ইনস্টল সফল বলে দেখানো হয়নি।"
                )
            }
        }
        AppPackageTaskAction.UNINSTALL_APP -> {
            if (packageName != null && packageName !in after) {
                AppPackageTaskResult(
                    requestId, action, AppPackageTaskStatus.SUCCEEDED,
                    "Android থেকে ফেরার পর লক্ষ্য প্যাকেজ অনুপস্থিত—আনইনস্টল যাচাই হয়েছে।",
                    packageName, packageStateVerified = true
                )
            } else {
                AppPackageTaskResult(
                    requestId, action, AppPackageTaskStatus.UNKNOWN,
                    "ফেরার পর লক্ষ্য প্যাকেজ সরানো হয়েছে বলে নিশ্চিত করা যায়নি; আনইনস্টল সফল দেখানো হয়নি।",
                    packageName
                )
            }
        }
        AppPackageTaskAction.SEARCH_PLAY_STORE -> AppPackageTaskResult(
            requestId, action, AppPackageTaskStatus.UNKNOWN,
            "Play Store খোলা ইনস্টল সফল হওয়ার প্রমাণ নয়।"
        )
    }
}
