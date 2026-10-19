package com.mosharrof.agent.admin

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import android.app.AlertDialog

/** Exposes the optional managed-device pathway without pretending a normal app has owner privileges. */
object ManagedDeviceControl {
    fun addTo(activity: Activity, layout: LinearLayout, status: TextView) {
        val summary = TextView(activity).apply { textSize = 14f }
        fun refresh() {
            val manager = activity.getSystemService(DevicePolicyManager::class.java)
            val receiver = ComponentName(activity, MosharrofDeviceAdminReceiver::class.java)
            summary.text = buildString {
                appendLine("Device Admin: ${if (manager?.isAdminActive(receiver) == true) "চালু" else "চালু নয়"}")
                appendLine("Device Owner: ${if (manager?.isDeviceOwnerApp(activity.packageName) == true) "চালু" else "চালু নয়"}")
                appendLine("Device Owner mode সাধারণ runtime permission নয়; Android-এর managed-device/ADB provisioning দরকার।")
            }
        }
        layout.addView(TextView(activity).apply { text = "উন্নত নিয়ন্ত্রণ • Managed Device / ADB"; textSize = 20f })
        layout.addView(summary)
        layout.addView(Button(activity).apply {
            text = "Device Admin অনুমতি সক্রিয় করুন"
            setOnClickListener {
                val receiver = ComponentName(activity, MosharrofDeviceAdminReceiver::class.java)
                AlertDialog.Builder(activity)
                    .setTitle("Device Admin সক্রিয় করবেন?")
                    .setMessage("এটি Android-এর Device Admin স্ক্রিন খুলবে। এই অনুমতি একা Device Owner বা unrestricted control দেয় না।")
                    .setNegativeButton("বাতিল", null)
                    .setPositiveButton("Android Settings খুলুন") { _, _ ->
                        activity.startActivity(Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                            putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, receiver)
                            putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "MOSHARROF-এর user-approved device automation")
                        })
                    }.show()
            }
        })
        layout.addView(Button(activity).apply {
            text = "Developer Options / Wireless Debugging খুলুন"
            setOnClickListener {
                runCatching { activity.startActivity(Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS)) }
                    .onFailure { runCatching { activity.startActivity(Intent(Settings.ACTION_SETTINGS)) } }
            }
        })
        layout.addView(Button(activity).apply {
            text = "ADB Device Owner command কপি করুন"
            setOnClickListener {
                val receiver = ComponentName(activity, MosharrofDeviceAdminReceiver::class.java)
                val component = receiver.flattenToShortString()
                val command = "adb shell dpm set-device-owner $component"
                AlertDialog.Builder(activity)
                    .setTitle("Advanced provisioning command")
                    .setMessage("এটি শুধু বিশ্বস্ত নিজের কম্পিউটার/ADB সেশনে ব্যবহার করুন। Android-এর সংস্করণ ও device provisioning অনুযায়ী এটি ব্যর্থ হতে পারে; অনেক ডিভাইসে setup সম্পন্ন হওয়ার আগে বা factory reset-এর পর দরকার হয়। এই অ্যাপ নিজে থেকে কমান্ড চালায় না।\n\n$command")
                    .setNegativeButton("বন্ধ করুন", null)
                    .setPositiveButton("কপি করুন") { _, _ ->
                        val clipboard = activity.getSystemService(ClipboardManager::class.java)
                        clipboard?.setPrimaryClip(ClipData.newPlainText("MOSHARROF Device Owner command", command))
                        Toast.makeText(activity, "ADB command কপি হয়েছে।", Toast.LENGTH_SHORT).show()
                    }.show()
            }
        })
        layout.addView(Button(activity).apply {
            text = "Managed Device অবস্থা আবার যাচাই করুন"
            setOnClickListener { refresh(); status.text = "Device Admin/Owner অবস্থা আপডেট হয়েছে।" }
        })
        refresh()
    }
}
