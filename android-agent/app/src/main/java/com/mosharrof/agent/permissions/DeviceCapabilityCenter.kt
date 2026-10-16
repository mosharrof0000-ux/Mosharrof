package com.mosharrof.agent.permissions

import android.Manifest
import android.app.Activity
import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat

/** One place to inspect and open Android's owner-controlled permission surfaces. */
object DeviceCapabilityCenter {
    fun addTo(activity: Activity, layout: LinearLayout, status: TextView) {
        val summary = TextView(activity).apply { textSize = 14f }
        fun refresh() { summary.text = capabilitySummary(activity) }
        layout.addView(TextView(activity).apply {
            text = "ডিভাইস ক্ষমতা ও অনুমতি"
            textSize = 20f
        })
        layout.addView(summary)
        layout.addView(Button(activity).apply {
            text = "সাম্প্রতিক নোটিফিকেশন পড়ুন"
            setOnClickListener {
                status.text = com.mosharrof.agent.notifications.MosharrofNotificationListenerService.snapshot()
            }
        })
        layout.addView(Button(activity).apply {
            text = "অনুমতির অবস্থা যাচাই করুন"
            setOnClickListener { refresh(); status.text = "অনুমতির অবস্থা আপডেট হয়েছে।" }
        })
        addSettingsButton(activity, layout, status, "Accessibility control", Settings.ACTION_ACCESSIBILITY_SETTINGS)
        addSettingsButton(activity, layout, status, "Notification access", Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        addSettingsButton(activity, layout, status, "Usage access", Settings.ACTION_USAGE_ACCESS_SETTINGS)
        addSettingsButton(activity, layout, status, "Floating overlay", Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${activity.packageName}"))
        addSettingsButton(activity, layout, status, "All files access", allFilesIntent(activity))
        addSettingsButton(activity, layout, status, "Modify system settings", writeSettingsIntent(activity))
        addSettingsButton(activity, layout, status, "Exact alarms", exactAlarmIntent(activity))
        addSettingsButton(activity, layout, status, "Battery optimization", batteryIntent(activity))
        layout.addView(Button(activity).apply {
            text = "প্রয়োজনীয় runtime permission চাইুন"
            setOnClickListener {
                val missing = runtimePermissions().filter {
                    ContextCompat.checkSelfPermission(activity, it) != PackageManager.PERMISSION_GRANTED
                }
                if (missing.isEmpty()) status.text = "Manifest-এ থাকা runtime permission ইতিমধ্যে অনুমোদিত।"
                else activity.requestPermissions(missing.toTypedArray(), REQUEST_PERMISSIONS)
            }
        })
        refresh()
    }

    fun capabilitySummary(context: Context): String = buildString {
        appendLine("Accessibility: ${if (isAccessibilityEnabled(context)) "চালু" else "চালু করা দরকার"}")
        appendLine("Notification access: ${if (isNotificationAccessEnabled(context)) "চালু" else "চালু করা দরকার"}")
        appendLine("Usage access: ${if (hasUsageAccess(context)) "চালু" else "চালু করা দরকার"}")
        appendLine("Floating overlay: ${if (Settings.canDrawOverlays(context)) "চালু" else "চালু করা দরকার"}")
        appendLine("All files: ${if (Build.VERSION.SDK_INT < 30 || Environment.isExternalStorageManager()) "উপলব্ধ/অনুমোদিত" else "অনুমতি দরকার"}")
        appendLine("Modify settings: ${if (Build.VERSION.SDK_INT < 23 || Settings.canWrite(context)) "অনুমোদিত" else "অনুমতি দরকার"}")
        appendLine("Exact alarms: ${if (Build.VERSION.SDK_INT < 31 || context.getSystemService(android.app.AlarmManager::class.java).canScheduleExactAlarms()) "অনুমোদিত" else "অনুমতি দরকার"}")
        appendLine("Runtime permissions: ${runtimePermissions().count { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }}/${runtimePermissions().size} granted")
        append("অনুমতি Android Settings-এ ব্যবহারকারী নিজে অনুমোদন করেন; এই অ্যাপ গোপনে অনুমতি দিতে পারে না।")
    }

    private fun isAccessibilityEnabled(context: Context): Boolean =
        Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
            ?.contains(context.packageName) == true

    private fun isNotificationAccessEnabled(context: Context): Boolean {
        val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
        return enabled.split(':').any { it.contains(context.packageName) }
    }

    private fun hasUsageAccess(context: Context): Boolean {
        val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= 29) {
            ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), context.packageName)
        } else {
            @Suppress("DEPRECATION")
            ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), context.packageName)
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun addSettingsButton(activity: Activity, layout: LinearLayout, status: TextView, label: String, action: String, data: Uri? = null) {
        layout.addView(Button(activity).apply {
            text = "$label — সেটিংস খুলুন"
            setOnClickListener {
                val intent = Intent(action).apply {
                    if (data != null) this.data = data
                    if (action == Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION ||
                        action == Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM ||
                        action == Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS ||
                        action == Settings.ACTION_MANAGE_WRITE_SETTINGS ||
                        action == Settings.ACTION_APPLICATION_DETAILS_SETTINGS) {
                        this.data = Uri.parse("package:${activity.packageName}")
                    }
                }
                runCatching { activity.startActivity(intent) }
                    .onFailure { status.text = "$label সেটিংস খোলা যায়নি: ${it.message ?: "অজানা সমস্যা"}" }
                    .onSuccess { status.text = "$label সেটিংস খুলেছে; Android-এ অনুমতি যাচাই করুন।" }
            }
        })
    }

    private fun allFilesIntent(activity: Activity): String =
        if (Build.VERSION.SDK_INT >= 30) Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION else Settings.ACTION_APPLICATION_DETAILS_SETTINGS

    private fun writeSettingsIntent(activity: Activity): String =
        if (Build.VERSION.SDK_INT >= 23) Settings.ACTION_MANAGE_WRITE_SETTINGS else Settings.ACTION_SETTINGS

    private fun exactAlarmIntent(activity: Activity): String =
        if (Build.VERSION.SDK_INT >= 31) Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM else Settings.ACTION_SETTINGS

    private fun batteryIntent(activity: Activity): String =
        if (Build.VERSION.SDK_INT >= 23) Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS else Settings.ACTION_SETTINGS

    private fun runtimePermissions(): List<String> = buildList {
        add(Manifest.permission.RECORD_AUDIO)
        add(Manifest.permission.ACCESS_COARSE_LOCATION)
        add(Manifest.permission.ACCESS_FINE_LOCATION)
        add(Manifest.permission.CAMERA)
        add(Manifest.permission.READ_CONTACTS)
        add(Manifest.permission.WRITE_CONTACTS)
        add(Manifest.permission.READ_CALENDAR)
        add(Manifest.permission.WRITE_CALENDAR)
        if (Build.VERSION.SDK_INT >= 31) add(Manifest.permission.BLUETOOTH_CONNECT)
        if (Build.VERSION.SDK_INT >= 33) {
            add(Manifest.permission.POST_NOTIFICATIONS)
            add(Manifest.permission.READ_MEDIA_IMAGES)
            add(Manifest.permission.READ_MEDIA_VIDEO)
            add(Manifest.permission.READ_MEDIA_AUDIO)
        } else {
            add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
    }

    private const val REQUEST_PERMISSIONS = 8301
}
