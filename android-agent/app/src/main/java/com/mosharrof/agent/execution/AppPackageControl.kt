package com.mosharrof.agent.execution

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.widget.TextView

/**
 * Delegates package changes to Android's own package installer/uninstaller UI.
 * This class never silently installs, silently removes, or bypasses OS confirmation.
 */
object AppPackageControl {
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
