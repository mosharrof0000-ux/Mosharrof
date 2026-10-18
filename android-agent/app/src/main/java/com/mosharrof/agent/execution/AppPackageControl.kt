package com.mosharrof.agent.execution

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.widget.TextView
import android.content.pm.PackageManager

/**
 * Delegates package changes to Android's own package installer/uninstaller UI.
 * This class never silently installs, silently removes, or bypasses OS confirmation.
 */
object AppPackageControl {
    /** Natural-language entry point; package changes remain in Android-owned screens. */
    fun handleCommand(activity: Activity, rawCommand: String, status: TextView, pickApk: () -> Unit): Boolean {
        val command = rawCommand.trim()
        if (command.length !in 1..240) return false
        val lower = command.lowercase()
        if (lower in setOf("uninstall app", "অ্যাপ আনইনস্টল করো", "আনইনস্টল করো", "আনইনস্টল করুন")) {
            status.text = "কোন অ্যাপটি আনইনস্টল করতে হবে তার সঠিক নাম বলুন।"
            return true
        }
        val uninstallPrefixes = listOf("uninstall ", "remove app ", "অ্যাপ আনইনস্টল ", "আনইনস্টল করো ", "আনইনস্টল করুন ")
        val uninstallSuffixes = listOf(" আনইনস্টল করো", " আনইনস্টল করুন", " uninstall", " remove")
        val uninstallTarget = uninstallPrefixes.firstOrNull { lower.startsWith(it) }?.let { command.drop(it.length).trim() }
            ?: uninstallSuffixes.firstOrNull { lower.endsWith(it) }?.let { command.dropLast(it.length).trim() }
        if (uninstallTarget != null) {
            if (uninstallTarget.isBlank()) {
                status.text = "কোন অ্যাপটি আনইনস্টল করতে হবে তার সঠিক নাম বলুন।"
                return true
            }
            val packageName = resolveInstalledPackage(activity, uninstallTarget)
            if (packageName == null) status.text = "ইনস্টল করা অ্যাপের সঠিক নাম মেলেনি; কোনো অ্যাপ সরানো হয়নি।"
            else requestUninstall(activity, packageName, status)
            return true
        }
        val installWithoutName = lower in setOf("install app", "অ্যাপ ইনস্টল করো", "অ্যাপ ইনস্টল করুন", "ইনস্টল করো", "ইনস্টল করুন")
        val installPrefixes = listOf("install ", "install app ", "অ্যাপ ইনস্টল ", "ইনস্টল করো ", "ইনস্টল করুন ")
        val installSuffixes = listOf(" ইনস্টল করো", " ইনস্টল করুন", " install")
        val installTarget = installPrefixes.firstOrNull { lower.startsWith(it) }?.let { command.drop(it.length).trim() }
            ?: installSuffixes.firstOrNull { lower.endsWith(it) }?.let { command.dropLast(it.length).trim() }
        if (installTarget != null || installWithoutName) {
            if (installWithoutName || installTarget.isNullOrBlank() || installTarget.equals("apk", true) ||
                installTarget.equals("app", true) || installTarget.equals("অ্যাপ", true) ||
                installTarget.contains("ফাইল") || installTarget.contains("apk")) {
                status.text = "Android ফাইল পিকার থেকে APK নির্বাচন করুন।"
                pickApk()
            } else {
                AlertDialog.Builder(activity)
                    .setTitle("অ্যাপ খুঁজুন")
                    .setMessage("\"$installTarget\" অ্যাপটি Play Store-এ খোঁজা হবে। ইনস্টল করার সিদ্ধান্ত ও অনুমতি Play Store/Android-এ আপনার হাতে থাকবে।")
                    .setNegativeButton("বাতিল", null)
                    .setPositiveButton("Play Store খুলুন") { _, _ ->
                        val uri = Uri.parse("market://search?q=" + Uri.encode(installTarget))
                        try {
                            activity.startActivity(Intent(Intent.ACTION_VIEW, uri))
                            status.text = "Play Store search খোলা হয়েছে; ইনস্টল সফল হয়েছে কি না পরে যাচাই করতে হবে।"
                        } catch (_: Exception) {
                            val web = Uri.parse("https://play.google.com/store/search?q=" + Uri.encode(installTarget) + "&c=apps")
                            runCatching { activity.startActivity(Intent(Intent.ACTION_VIEW, web)) }
                                .onSuccess { status.text = "Play Store-এর সার্চ পেজ খোলা হয়েছে।" }
                                .onFailure { status.text = "অ্যাপ খোঁজার পেজ খোলা যায়নি।" }
                        }
                    }.show()
            }
            return true
        }
        return false
    }

    private fun resolveInstalledPackage(activity: Activity, query: String): String? {
        if (PACKAGE_NAME.matches(query)) {
            return try {
                @Suppress("DEPRECATION")
                activity.packageManager.getApplicationInfo(query, 0)
                query
            } catch (_: Exception) { null }
        }
        val wanted = query.trim().lowercase()
        return try {
            @Suppress("DEPRECATION")
            activity.packageManager.getInstalledApplications(PackageManager.GET_META_DATA)
                .firstOrNull { activity.packageManager.getApplicationLabel(it).toString().trim().lowercase() == wanted }
                ?.packageName
        } catch (_: Exception) { null }
    }


    fun requestInstallFromSelectedUri(activity: Activity, apkUri: Uri, status: TextView) {
        if (apkUri.scheme != "content") {
            status.text = "নিরাপদভাবে ইনস্টল করতে Android ফাইল পিকার থেকে content URI নির্বাচন করুন।"
            return
        }
        AlertDialog.Builder(activity)
            .setTitle("অ্যাপ ইনস্টল করার আগে যাচাই")
            .setMessage("নির্বাচিত ফাইলটি Android-এর প্যাকেজ ইনস্টলার খুলবে। অচেনা উৎসের অ্যাপ ইনস্টল করবেন না। Android-এর নিজস্ব অনুমতি ও নিশ্চিতকরণ লাগবে।")
            .setNegativeButton("বাতিল", null)
            .setPositiveButton("ইনস্টলার খুলুন") { _, _ ->
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(apkUri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                try {
                    activity.startActivity(intent)
                    status.text = "Android প্যাকেজ ইনস্টলার খোলা হয়েছে; ইনস্টল সফল হয়েছে কি না Android-এ যাচাই করুন।"
                } catch (_: Exception) {
                    status.text = "এই ডিভাইসে উপযুক্ত প্যাকেজ ইনস্টলার খোলা যায়নি।"
                }
            }
            .show()
    }

    fun requestUninstall(activity: Activity, packageName: String, status: TextView) {
        val normalized = packageName.trim()
        if (!PACKAGE_NAME.matches(normalized)) {
            status.text = "সঠিক package name দিন; কোনো অ্যাপ সরানো হয়নি।"
            return
        }
        val installed = try {
            @Suppress("DEPRECATION")
            activity.packageManager.getApplicationInfo(normalized, 0)
            true
        } catch (_: Exception) {
            false
        }
        if (!installed) {
            status.text = "এই package name-এর ইনস্টল করা অ্যাপ পাওয়া যায়নি।"
            return
        }
        AlertDialog.Builder(activity)
            .setTitle("অ্যাপ আনইনস্টল")
            .setMessage("$normalized অ্যাপটির জন্য Android-এর আনইনস্টল স্ক্রিন খোলা হবে। চূড়ান্ত সিদ্ধান্ত Android-এর স্ক্রিনে নিশ্চিত করতে হবে।")
            .setNegativeButton("বাতিল", null)
            .setPositiveButton("আনইনস্টল স্ক্রিন খুলুন") { _, _ ->
                try {
                    activity.startActivity(Intent(Intent.ACTION_DELETE, Uri.parse("package:$normalized")))
                    status.text = "Android-এর আনইনস্টল স্ক্রিন খোলা হয়েছে; ফলাফল সেখানে যাচাই করুন।"
                } catch (_: Exception) {
                    status.text = "Android-এর আনইনস্টল স্ক্রিন খোলা যায়নি।"
                }
            }
            .show()
    }

    private val PACKAGE_NAME = Regex("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+")
}
