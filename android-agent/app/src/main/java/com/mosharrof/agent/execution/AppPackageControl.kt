package com.mosharrof.agent.execution

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.widget.TextView

/**
 * User-directed app installation/removal.
 * Android's package installer, Play Store, and uninstaller retain final control and confirmation.
 */
object AppPackageControl {
    fun handleCommand(activity: Activity, rawCommand: String, status: TextView, pickApk: () -> Unit): Boolean {
        return when (val command = AppPackageCommandParser.parse(rawCommand)) {
            AppPackageCommand.NotRecognized -> false
            AppPackageCommand.PickApk -> {
                status.text = "Android ফাইল পিকার থেকে APK নির্বাচন করুন।"
                pickApk()
                true
            }
            AppPackageCommand.AskUninstallTarget -> {
                status.text = "কোন ইনস্টল করা অ্যাপটি আনইনস্টল করতে হবে তার সঠিক নাম বলুন।"
                true
            }
            is AppPackageCommand.SearchStore -> {
                AlertDialog.Builder(activity)
                    .setTitle("অ্যাপ খুঁজুন")
                    .setMessage("\"${command.query}\" অ্যাপটি Play Store-এ খোঁজা হবে। ইনস্টল ও অনুমতির চূড়ান্ত সিদ্ধান্ত আপনার হাতে থাকবে।")
                    .setNegativeButton("বাতিল", null)
                    .setPositiveButton("Play Store খুলুন") { _, _ ->
                        val market = Uri.parse("market://search?q=" + Uri.encode(command.query))
                        try {
                            activity.startActivity(Intent(Intent.ACTION_VIEW, market))
                            status.text = "Play Store-এর সার্চ খোলা হয়েছে; ইনস্টল সম্পন্ন হয়েছে কি না আলাদাভাবে যাচাই করুন।"
                        } catch (_: Exception) {
                            val web = Uri.parse("https://play.google.com/store/search?q=" + Uri.encode(command.query) + "&c=apps")
                            runCatching { activity.startActivity(Intent(Intent.ACTION_VIEW, web)) }
                                .onSuccess { status.text = "Play Store-এর সার্চ পেজ খোলা হয়েছে।" }
                                .onFailure { status.text = "অ্যাপ খোঁজার পেজ খোলা যায়নি।" }
                        }
                    }.show()
                true
            }
            is AppPackageCommand.Uninstall -> {
                val packageName = resolveInstalledLauncherPackage(activity, command.target)
                if (packageName == null) status.text = "মিল থাকা ইনস্টল করা অ্যাপ পাওয়া যায়নি; কোনো অ্যাপ সরানো হয়নি।"
                else requestUninstall(activity, packageName, status)
                true
            }
        }
    }

    private fun resolveInstalledLauncherPackage(activity: Activity, query: String): String? {
        val normalized = query.trim()
        if (PACKAGE_NAME.matches(normalized)) return if (isInstalled(activity, normalized)) normalized else null
        val wanted = normalized.lowercase()
        return try {
            val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            @Suppress("DEPRECATION")
            val matches = activity.packageManager.queryIntentActivities(launcherIntent, 0)
                .filter { info -> info.loadLabel(activity.packageManager).toString().trim().lowercase() == wanted }
                .map { it.activityInfo.packageName }
                .distinct()
            matches.singleOrNull()
        } catch (_: Exception) { null }
    }

    fun requestInstallFromSelectedUri(activity: Activity, apkUri: Uri, status: TextView) {
        if (apkUri.scheme != "content") {
            status.text = "নিরাপদ ইনস্টলের জন্য Android ফাইল পিকার থেকে APK নির্বাচন করুন।"
            return
        }
        AlertDialog.Builder(activity)
            .setTitle("অ্যাপ ইনস্টল করার আগে যাচাই")
            .setMessage("Android-এর প্যাকেজ ইনস্টলার খুলবে। অচেনা উৎসের APK ইনস্টল করবেন না। Android-এর নিজস্ব অনুমতি ও নিশ্চিতকরণ লাগবে।")
            .setNegativeButton("বাতিল", null)
            .setPositiveButton("ইনস্টলার খুলুন") { _, _ ->
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(apkUri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                try {
                    activity.startActivity(intent)
                    status.text = "Android প্যাকেজ ইনস্টলার খোলা হয়েছে; সফল ইনস্টল Android-এর স্ক্রিনে নিশ্চিত করুন।"
                } catch (_: Exception) {
                    status.text = "এই ডিভাইসে উপযুক্ত প্যাকেজ ইনস্টলার খোলা যায়নি।"
                }
            }.show()
    }

    fun requestUninstall(activity: Activity, packageName: String, status: TextView) {
        val normalized = packageName.trim()
        if (!PACKAGE_NAME.matches(normalized) || normalized == activity.packageName || !isInstalled(activity, normalized)) {
            status.text = "অ্যাপের package name ভুল, নিজের অ্যাপ, বা ইনস্টল করা অ্যাপের সঙ্গে মেলেনি; কিছু সরানো হয়নি।"
            return
        }
        AlertDialog.Builder(activity)
            .setTitle("অ্যাপ আনইনস্টল")
            .setMessage("${normalized} অ্যাপটির Android আনইনস্টল স্ক্রিন খোলা হবে। চূড়ান্ত সিদ্ধান্ত সেখানে নিশ্চিত করতে হবে।")
            .setNegativeButton("বাতিল", null)
            .setPositiveButton("আনইনস্টল স্ক্রিন খুলুন") { _, _ ->
                try {
                    activity.startActivity(Intent(Intent.ACTION_DELETE, Uri.parse("package:$normalized")))
                    status.text = "Android-এর আনইনস্টল স্ক্রিন খোলা হয়েছে; ফলাফল সেখানে যাচাই করুন।"
                } catch (_: Exception) {
                    status.text = "Android-এর আনইনস্টল স্ক্রিন খোলা যায়নি।"
                }
            }.show()
    }

    private fun isInstalled(activity: Activity, packageName: String): Boolean = try {
        @Suppress("DEPRECATION")
        activity.packageManager.getApplicationInfo(packageName, 0)
        true
    } catch (_: Exception) { false }

    private val PACKAGE_NAME = Regex("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+")
}
