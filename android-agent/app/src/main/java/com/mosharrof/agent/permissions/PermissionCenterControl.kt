package com.mosharrof.agent.permissions

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import android.content.pm.PackageManager

/** Explicit, user-driven permission hub. Android remains the authority for each grant. */
object PermissionCenterControl {
    val runtimePermissions: Array<String> get() = buildList {
        addAll(listOf(Manifest.permission.RECORD_AUDIO,
            Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS,
            Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR,
            Manifest.permission.READ_PHONE_STATE, Manifest.permission.CALL_PHONE,
            Manifest.permission.ANSWER_PHONE_CALLS, Manifest.permission.READ_CALL_LOG,
            Manifest.permission.WRITE_CALL_LOG, Manifest.permission.SEND_SMS,
            Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS,
            ))
        if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
        if (Build.VERSION.SDK_INT >= 31) addAll(listOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT))
        if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.NEARBY_WIFI_DEVICES)
    }.distinct().toTypedArray()

    fun addTo(activity: Activity, layout: LinearLayout, status: TextView, requestRuntime: () -> Unit) {
        layout.addView(Button(activity).apply {
            text = "ডিভাইসের অনুমতিগুলো সক্রিয় করুন"
            setOnClickListener { requestRuntime() }
        })
        layout.addView(Button(activity).apply {
            text = "Background location অনুমতি"
            setOnClickListener {
                if (Build.VERSION.SDK_INT >= 30) open(activity, Settings.ACTION_APPLICATION_DETAILS_SETTINGS, status)
                else status.text = "প্রথমে সামনে থাকা অবস্থায় Location অনুমতি দিন।"
            }
        })
        specialButton(activity, layout, "Accessibility — স্ক্রিন বুঝে নিয়ন্ত্রণ", Settings.ACTION_ACCESSIBILITY_SETTINGS, status)
        specialButton(activity, layout, "ব্যবহারের পরিসংখ্যানের অনুমতি", Settings.ACTION_USAGE_ACCESS_SETTINGS, status)
        specialButton(activity, layout, "Notification access", Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS, status)
        specialButton(activity, layout, "সিস্টেম সেটিংস পরিবর্তন", Settings.ACTION_MANAGE_WRITE_SETTINGS, status)
        specialButton(activity, layout, "ব্যাটারি অপ্টিমাইজেশন থেকে ছাড়", Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS, status)
        if (Build.VERSION.SDK_INT >= 31) specialButton(activity, layout, "Exact alarm অনুমতি", Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, status)
        layout.addView(Button(activity).apply {
            text = "অনুমতির অবস্থা যাচাই করুন"
            setOnClickListener { status.text = permissionSummary(activity) }
        })
    }

    fun permissionSummary(activity: Activity): String = buildString {
        appendLine("MOSHARROF অনুমতি যাচাই")
        runtimePermissions.forEach { permission ->
            val granted = ContextCompat.checkSelfPermission(activity, permission) == PackageManager.PERMISSION_GRANTED
            appendLine("${if (granted) "✓" else "○"} ${permission.substringAfterLast(".")}: ${if (granted) "অনুমোদিত" else "অনুমোদিত নয়"}")
        }
        appendLine("○ Write system settings: ${if (Settings.System.canWrite(activity)) "অনুমোদিত" else "অননুমোদিত"}")
        if (Build.VERSION.SDK_INT >= 30) {
            val pm = activity.getSystemService(PowerManager::class.java)
            appendLine("○ Battery optimization exemption: ${if (pm?.isIgnoringBatteryOptimizations(activity.packageName) == true) "অনুমোদিত" else "অননুমোদিত"}")
        }
        if (Build.VERSION.SDK_INT >= 31) {
            appendLine("○ Exact alarm: ${if (activity.getSystemService(android.app.AlarmManager::class.java)?.canScheduleExactAlarms() == true) "অনুমোদিত" else "অননুমোদিত"}")
        }
        val appOps = activity.getSystemService(android.app.AppOpsManager::class.java)
        val usage = appOps?.checkOpNoThrow(android.app.AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), activity.packageName) == android.app.AppOpsManager.MODE_ALLOWED
        appendLine("○ Usage access: ${if (usage) "অনুমোদিত" else "অননুমোদিত"}")
        val listeners = android.provider.Settings.Secure.getString(activity.contentResolver, "enabled_notification_listeners").orEmpty()
        appendLine("○ Notification access: ${if (listeners.contains(activity.packageName)) "অনুমোদিত" else "অননুমোদিত"}")
        append("বিশেষ অনুমতিগুলো Settings-এ আলাদাভাবে চালু করতে হয়; Android-এর সম্মতি ছাড়া অ্যাপ সেগুলো নিজে চালু করতে পারে না।")
    }

    private fun specialButton(activity: Activity, layout: LinearLayout, label: String, action: String, status: TextView) {
        layout.addView(Button(activity).apply { text = label; setOnClickListener { open(activity, action, status) } })
    }

    private fun open(activity: Activity, action: String, status: TextView) {
        try {
            val intent = when (action) {
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Settings.ACTION_MANAGE_WRITE_SETTINGS, Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS ->
                    Intent(action, Uri.parse("package:${activity.packageName}"))
                else -> Intent(action)
            }
            activity.startActivity(intent)
            status.text = "Android Settings খোলা হয়েছে। অনুমতি দিয়ে ফিরে এসে অবস্থা যাচাই করুন।"
        } catch (_: Exception) { status.text = "এই Android সংস্করণে সেটিংস পৃষ্ঠা খোলা যায়নি।" }
    }
}
