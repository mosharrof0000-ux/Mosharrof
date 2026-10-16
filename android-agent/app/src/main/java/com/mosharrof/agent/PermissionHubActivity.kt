package com.mosharrof.agent

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.app.AppOpsManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.PowerManager
import android.provider.Settings
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.ContextCompat

/** Explicit, user-controlled onboarding for Android permissions and special app access. */
class PermissionHubActivity : Activity() {
    private lateinit var details: TextView
    private lateinit var container: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = "MOSHARROF — অনুমতি ও ক্ষমতা"
        details = TextView(this).apply { textSize = 15f }
        container = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(28, 24, 28, 32) }
        container.addView(TextView(this).apply { text = "Android ক্ষমতা কেন্দ্র"; textSize = 24f })
        container.addView(TextView(this).apply {
            text = "প্রতিটি অনুমতি আপনার সিদ্ধান্তে চালু হবে। শুধু প্রয়োজনীয় ক্ষমতা দিন; Android-এর সিস্টেম-সীমা এই অ্যাপ নিজে থেকে অতিক্রম করতে পারে না।"
            textSize = 14f
        })
        container.addView(details)
        addAction("Accessibility — স্ক্রিন বোঝা, ট্যাপ, স্ক্রল ও নেভিগেশন", Settings.ACTION_ACCESSIBILITY_SETTINGS, false)
        addAction("অন্য অ্যাপের ওপর ভাসমান কন্ট্রোল", Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
        addAction("সব ফাইল অ্যাক্সেস — ফাইল ম্যানেজমেন্ট", Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
        addAction("Usage access — অ্যাপ ব্যবহারের তথ্য", Settings.ACTION_USAGE_ACCESS_SETTINGS, false)
        addAction("সিস্টেম সেটিংস পরিবর্তনের অনুমতি", Settings.ACTION_MANAGE_WRITE_SETTINGS)
        addAction("ব্যাটারি অপ্টিমাইজেশন থেকে বাদ দিন", Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
        addAction("নির্ভুল অ্যালার্মের অনুমতি", Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
        container.addView(Button(this).apply {
            text = "মাইক্রোফোন, নোটিফিকেশন, কন্টাক্ট, ক্যালেন্ডার ও মিডিয়া অনুমতি"
            setOnClickListener { requestRuntimePermissions() }
        })
        container.addView(Button(this).apply {
            text = "অ্যাপের সব অনুমতি দেখুন"
            setOnClickListener { openAppDetails() }
        })
        container.addView(Button(this).apply {
            text = "অনুমতির অবস্থা আবার যাচাই করুন"
            setOnClickListener { refreshStatus() }
        })
        setContentView(ScrollView(this).apply { addView(container, ViewGroup.LayoutParams(-1, -2)) })
        refreshStatus()
    }

    override fun onResume() { super.onResume(); if (::details.isInitialized) refreshStatus() }

    private fun addAction(label: String, action: String, withPackage: Boolean = true) {
        container.addView(Button(this).apply {
            text = label
            setOnClickListener {
                val intent = Intent(action)
                if (withPackage) intent.data = Uri.parse("package:$packageName")
                try { startActivity(intent) } catch (_: Exception) { openAppDetails() }
            }
        })
    }

    private fun openAppDetails() {
        startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
    }

    private fun requestRuntimePermissions() {
        val wanted = buildList {
            add(Manifest.permission.RECORD_AUDIO)
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
            add(Manifest.permission.READ_CONTACTS)
            add(Manifest.permission.WRITE_CONTACTS)
            add(Manifest.permission.READ_CALENDAR)
            add(Manifest.permission.WRITE_CALENDAR)
            if (Build.VERSION.SDK_INT >= 33) {
                add(Manifest.permission.READ_MEDIA_IMAGES)
                add(Manifest.permission.READ_MEDIA_VIDEO)
                add(Manifest.permission.READ_MEDIA_AUDIO)
            } else if (Build.VERSION.SDK_INT >= 23) add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }.distinct().filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (wanted.isEmpty()) refreshStatus() else requestPermissions(wanted.toTypedArray(), REQUEST_PERMISSIONS)
    }

    private fun refreshStatus() {
        val runtime = listOf(
            "মাইক্রোফোন" to Manifest.permission.RECORD_AUDIO,
            "কন্টাক্ট পড়া" to Manifest.permission.READ_CONTACTS,
            "ক্যালেন্ডার পড়া" to Manifest.permission.READ_CALENDAR
        ).joinToString("\n") { (label, permission) -> "$label: ${granted(permission)}" }
        val overlay = Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this)
        val files = Build.VERSION.SDK_INT < 30 || Environment.isExternalStorageManager()
        val write = Build.VERSION.SDK_INT < 23 || Settings.canWrite(this)
        val usage = try {
            val appOps = getSystemService(APP_OPS_SERVICE) as AppOpsManager
            appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), packageName) == AppOpsManager.MODE_ALLOWED
        } catch (_: Exception) { false }
        val battery = Build.VERSION.SDK_INT < 23 || (getSystemService(POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(packageName)
        val alarm = Build.VERSION.SDK_INT < 31 || (getSystemService(ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()
        details.text = "\nঅনুমতি যাচাই:\n$runtime\nওভারলে: ${yesNo(overlay)}\nসব ফাইল অ্যাক্সেস: ${yesNo(files)}\nUsage access: ${yesNo(usage)}\nসিস্টেম সেটিংস: ${yesNo(write)}\nব্যাটারি সীমাবদ্ধতা থেকে মুক্ত: ${yesNo(battery)}\nExact alarm: ${yesNo(alarm)}\n\nনোট: কোনো অনুমতি দিলেই Android-এর সব নিরাপত্তা সীমা উঠে যায় না; কিছু কাজের জন্য ADB/Device Owner বা সিস্টেম-স্বাক্ষরিত অ্যাপ লাগে।"
    }

    private fun granted(permission: String) =
        yesNo(ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED)
    private fun yesNo(value: Boolean) = if (value) "চালু" else "বন্ধ"

    companion object { private const val REQUEST_PERMISSIONS = 731 }
}
