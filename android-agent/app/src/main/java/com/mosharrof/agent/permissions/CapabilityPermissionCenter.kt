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
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.ContextCompat
import android.app.AlertDialog as PlatformAlertDialog

/**
 * A single user-facing inventory of Android capabilities. It reports actual OS grants
 * and opens the system-owned consent UI; it never silently bypasses protected controls.
 */
object CapabilityPermissionCenter {
    private data class Capability(
        val title: String,
        val purpose: String,
        val permissions: List<String> = emptyList(),
        val settingsAction: String? = null,
        val readiness: (Activity) -> Boolean = { false }
    )

    fun addButton(activity: Activity, layout: LinearLayout) {
        layout.addView(Button(activity).apply {
            text = "ডিভাইসের ক্ষমতা ও অনুমতি পরিচালনা করুন"
            setOnClickListener { show(activity) }
        })
    }

    private fun show(activity: Activity) {
        val scroll = ScrollView(activity)
        val list = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24, 12, 24, 12)
        }
        scroll.addView(list)
        val dialog = PlatformAlertDialog.Builder(activity)
            .setTitle("MOSHARROF • ক্ষমতা ও অনুমতি")
            .setView(scroll)
            .setPositiveButton("বন্ধ করুন", null)
            .create()
        fun refresh() {
            list.removeAllViews()
            list.addView(TextView(activity).apply {
                text = "প্রতিটি ক্ষমতার অবস্থা Android-এর বর্তমান অনুমতি থেকে দেখানো হয়। প্রয়োজন হলে নিচের বোতাম Android-এর নিজস্ব অনুমতি/সেটিংস খুলবে। অনুমতি না দিলে সংশ্লিষ্ট কাজ সীমিত থাকবে।"
                textSize = 14f
            })
            capabilities(activity).forEach { capability ->
                val granted = capability.readiness(activity)
                list.addView(TextView(activity).apply {
                    text = (if (granted) "✓ " else "○ ") + capability.title + "\n" + capability.purpose + "\nঅবস্থা: " + if (granted) "প্রস্তুত" else "অনুমতি/সেটিংস প্রয়োজন"
                    textSize = 14f
                    setPadding(0, 20, 0, 6)
                })
                if (!granted) list.addView(Button(activity).apply {
                    text = "অনুমতি দিন / সেটিংস খুলুন"
                    setOnClickListener { openCapability(activity, capability); dialog.dismiss() }
                })
            }
            list.addView(TextView(activity).apply {
                text = "\nগুরুত্বপূর্ণ: Android-এর lock screen, protected system permissions, অন্য অ্যাপের private data এবং OS policy-কে সাধারণ অ্যাপ হিসেবে জোর করে অতিক্রম করা যায় না। সর্বোচ্চ নিয়ন্ত্রণের জন্য সমর্থিত অনুমতি, user-granted Accessibility, overlay, scoped file access এবং system intents একত্রে ব্যবহার করা হবে।"
                textSize = 13f
            })
        }
        refresh()
        dialog.setOnShowListener { refresh() }
        dialog.show()
    }

    private fun capabilities(activity: Activity): List<Capability> = listOf(
        Capability("Accessibility UI নিয়ন্ত্রণ", "স্ক্রিনের দৃশ্যমান UI পড়া, অনুমোদিত ট্যাপ/gesture ও global navigation.", settingsAction = Settings.ACTION_ACCESSIBILITY_SETTINGS, readiness = ::accessibilityEnabled),
        Capability("Floating control / overlay", "অন্য অ্যাপের উপরে ভাসমান কন্ট্রোল দেখানো.", settingsAction = Settings.ACTION_MANAGE_OVERLAY_PERMISSION, readiness = { Settings.canDrawOverlays(it) }),
        Capability("নোটিফিকেশন পড়া", "Android-এর আলাদা Notification access অনুমতি দিলে সাম্প্রতিক notification-এর bounded in-memory snapshot.", settingsAction = Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS, readiness = { com.mosharrof.agent.notifications.NotificationAccessControl.isAccessEnabled(it) }),
        Capability("ব্যবহারের পরিসংখ্যান", "Android অনুমতি দিলে অ্যাপ ব্যবহারের তথ্য.", settingsAction = Settings.ACTION_USAGE_ACCESS_SETTINGS, readiness = ::usageAccessGranted),
        Capability("সম্পূর্ণ ফাইল ব্যবস্থাপনা", "সমর্থিত Android সংস্করণে all-files access; অনুমতি পাওয়া গেলেও protected app data নয়.", settingsAction = Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, readiness = { Build.VERSION.SDK_INT < 30 || Environment.isExternalStorageManager() }),
        Capability("মাইক্রোফোন", "ভয়েস কমান্ড বা ভবিষ্যৎ hands-free voice session.", listOf(Manifest.permission.RECORD_AUDIO), readiness = { permissionsGranted(it, listOf(Manifest.permission.RECORD_AUDIO)) }),
        Capability("ক্যামেরা", "ক্যামেরা-নির্ভর ফিচারের জন্য runtime access.", listOf(Manifest.permission.CAMERA), readiness = { permissionsGranted(it, listOf(Manifest.permission.CAMERA)) }),
        Capability("লোকেশন", "লোকেশন-ভিত্তিক কমান্ড; background location আলাদা Android অনুমতি.", listOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION), readiness = { permissionsGranted(it, listOf(Manifest.permission.ACCESS_COARSE_LOCATION)) || permissionsGranted(it, listOf(Manifest.permission.ACCESS_FINE_LOCATION)) }),
        Capability("Bluetooth / কাছাকাছি ডিভাইস", "Android সংস্করণ অনুযায়ী Bluetooth scan/connect access.", bluetoothPermissions(), readiness = { permissionsGranted(it, bluetoothPermissions()) }),
        Capability("ফোন কল", "সমর্থিত কল action; Android ও ডিফল্ট ফোন অ্যাপের সীমা প্রযোজ্য.", listOf(Manifest.permission.CALL_PHONE, Manifest.permission.ANSWER_PHONE_CALLS), readiness = { permissionsGranted(it, listOf(Manifest.permission.CALL_PHONE)) && permissionsGranted(it, listOf(Manifest.permission.ANSWER_PHONE_CALLS)) }),
        Capability("SMS পাঠানো", "SMS পাঠানো সংবেদনশীল; ব্যবহারকারী-নিশ্চিত কাজ এবং OS/ডিফল্ট অ্যাপের নিয়ম প্রযোজ্য.", listOf(Manifest.permission.SEND_SMS), readiness = { permissionsGranted(it, listOf(Manifest.permission.SEND_SMS)) }),
        Capability("SMS পড়া/গ্রহণ", "SMS content সংবেদনশীল; শুধু নির্দিষ্ট প্রয়োজন ও স্পষ্ট অনুমতিতে.", listOf(Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS), readiness = { permissionsGranted(it, listOf(Manifest.permission.READ_SMS)) && permissionsGranted(it, listOf(Manifest.permission.RECEIVE_SMS)) }),
        Capability("কল লগ", "কল লগ সংবেদনশীল; ডিভাইস/OS ও Play policy সীমা প্রযোজ্য.", listOf(Manifest.permission.READ_CALL_LOG, Manifest.permission.WRITE_CALL_LOG), readiness = { permissionsGranted(it, listOf(Manifest.permission.READ_CALL_LOG)) }),
        Capability("সিস্টেম সেটিংস পরিবর্তন", "শুধু সমর্থিত সেটিংস; Android-এর বিশেষ access আলাদা.", settingsAction = Settings.ACTION_MANAGE_WRITE_SETTINGS, readiness = { Build.VERSION.SDK_INT < 23 || Settings.System.canWrite(it) }),
        Capability("Battery optimization", "দীর্ঘ কাজের জন্য battery optimization অবস্থা; exemption ঐচ্ছিক.", settingsAction = Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS, readiness = ::batteryOptimizationIgnored),
        Capability("Camera", "ব্যবহারকারী অনুমতি দিলে ছবি/QR/ডকুমেন্ট capture.", listOf(Manifest.permission.CAMERA), readiness = { permissionsGranted(it, listOf(Manifest.permission.CAMERA)) }),
        Capability("Location", "GPS/নেটওয়ার্ক অবস্থান; background location আলাদা OS অনুমতি চায়.", listOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION), readiness = { permissionsGranted(it, listOf(Manifest.permission.ACCESS_COARSE_LOCATION)) || permissionsGranted(it, listOf(Manifest.permission.ACCESS_FINE_LOCATION)) }),
        Capability("Bluetooth / nearby devices", "নিকটবর্তী ডিভাইসের সঙ্গে সংযোগ; Android সংস্করণভেদে runtime permission.", bluetoothPermissions(), readiness = { bluetoothPermissions().isEmpty() || permissionsGranted(it, bluetoothPermissions()) }),
        Capability("Phone state", "SIM/নেটওয়ার্ক-সম্পর্কিত সীমিত phone state; সব telephony তথ্য সাধারণ অ্যাপে উপলব্ধ নয়.", listOf(Manifest.permission.READ_PHONE_STATE), readiness = { permissionsGranted(it, listOf(Manifest.permission.READ_PHONE_STATE)) }),
        Capability("Phone calls", "ব্যবহারকারীর নির্দেশে কল শুরু/উত্তর দেওয়ার অনুমতি; জরুরি কল/অন্য অ্যাপের নিয়ম প্রযোজ্য.", listOf(Manifest.permission.CALL_PHONE, Manifest.permission.ANSWER_PHONE_CALLS), readiness = { permissionsGranted(it, listOf(Manifest.permission.CALL_PHONE)) && permissionsGranted(it, listOf(Manifest.permission.ANSWER_PHONE_CALLS)) }),
        Capability("SMS / call log", "SMS ও call-log অনুমতি সংবেদনশীল এবং ডিভাইস/OS/ডিফল্ট অ্যাপের নিয়মে সীমাবদ্ধ হতে পারে.", listOf(Manifest.permission.READ_SMS, Manifest.permission.SEND_SMS, Manifest.permission.READ_CALL_LOG), readiness = { permissionsGranted(it, listOf(Manifest.permission.READ_SMS, Manifest.permission.SEND_SMS, Manifest.permission.READ_CALL_LOG)) }),
        Capability("Modify system settings", "সমর্থিত settings পরিবর্তন; protected settings-এর জন্য Android-এর নিজস্ব UI লাগতে পারে.", settingsAction = Settings.ACTION_MANAGE_WRITE_SETTINGS, readiness = { Build.VERSION.SDK_INT < 23 || Settings.System.canWrite(it) }),
        Capability("Battery optimization exemption", "দীর্ঘমেয়াদি কাজের জন্য OS অনুমোদন; ব্যাটারি/স্টোরের নীতির অধীন.", settingsAction = Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS, readiness = { Build.VERSION.SDK_INT < 23 || it.getSystemService(android.os.PowerManager::class.java)?.isIgnoringBatteryOptimizations(it.packageName) == true }),
        Capability("Contacts", "ব্যবহারকারী অনুমতি দিলে contacts পড়া/লেখা.", listOf(Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS), readiness = { permissionsGranted(it, listOf(Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS)) }),
        Capability("Calendar", "অনুমতি দিলে calendar পড়া/লেখা.", listOf(Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR), readiness = { permissionsGranted(it, listOf(Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR)) }),
        Capability("ছবি ও ভিডিও", "Android-এর media permission অনুযায়ী নির্বাচিত/অনুমোদিত মিডিয়া.", mediaPermissions(), readiness = { permissionsGranted(it, mediaPermissions()) }),
        Capability("অডিও ফাইল", "অনুমতি থাকলে shared audio media পড়া.", audioPermissions(), readiness = { permissionsGranted(it, audioPermissions()) }),
        Capability("Notifications", "Android 13+ এ notification permission.", notificationPermissions(), readiness = { permissionsGranted(it, notificationPermissions()) }),
        Capability("নির্দিষ্ট সময়ে অ্যালার্ম", "Exact alarm special access প্রয়োজন হলে Android সেটিংস খুলুন.", settingsAction = Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, readiness = { Build.VERSION.SDK_INT < 31 || activity.getSystemService(android.app.AlarmManager::class.java)?.canScheduleExactAlarms() == true })
    )

    private fun bluetoothPermissions(): List<String> = when {
        Build.VERSION.SDK_INT >= 31 -> listOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
        else -> listOf(Manifest.permission.BLUETOOTH, Manifest.permission.BLUETOOTH_ADMIN)
    }

    private fun smsAndCallLogPermissions(): List<String> = listOf(
        Manifest.permission.SEND_SMS, Manifest.permission.READ_SMS,
        Manifest.permission.RECEIVE_SMS, Manifest.permission.CALL_PHONE,
        Manifest.permission.READ_CALL_LOG, Manifest.permission.WRITE_CALL_LOG
    )

    private fun notificationListenerEnabled(activity: Activity): Boolean =
        Settings.Secure.getString(activity.contentResolver, "enabled_notification_listeners")
            ?.split(':')?.any { it.contains(activity.packageName) } == true

    private fun batteryOptimizationIgnored(activity: Activity): Boolean =
        activity.getSystemService(android.os.PowerManager::class.java)
            ?.isIgnoringBatteryOptimizations(activity.packageName) == true

    private fun mediaPermissions(): List<String> = when {
        Build.VERSION.SDK_INT >= 33 -> listOf(Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO)
        Build.VERSION.SDK_INT >= 23 -> listOf(Manifest.permission.READ_EXTERNAL_STORAGE)
        else -> emptyList()
    }

    private fun audioPermissions(): List<String> = when {
        Build.VERSION.SDK_INT >= 33 -> listOf(Manifest.permission.READ_MEDIA_AUDIO)
        Build.VERSION.SDK_INT >= 23 -> listOf(Manifest.permission.READ_EXTERNAL_STORAGE)
        else -> emptyList()
    }

    private fun notificationPermissions(): List<String> =
        if (Build.VERSION.SDK_INT >= 33) listOf(Manifest.permission.POST_NOTIFICATIONS) else emptyList()

    private fun permissionsGranted(activity: Activity, permissions: List<String>): Boolean =
        permissions.all { ContextCompat.checkSelfPermission(activity, it) == PackageManager.PERMISSION_GRANTED }

    private fun notificationAccessGranted(activity: Activity): Boolean =
        android.provider.Settings.Secure.getString(activity.contentResolver, "enabled_notification_listeners")
            .orEmpty().split(':').any { it.contains(activity.packageName) }

    private fun accessibilityEnabled(activity: Activity): Boolean {
        val manager = activity.getSystemService(Context.ACCESSIBILITY_SERVICE) as? android.view.accessibility.AccessibilityManager ?: return false
        return manager.getEnabledAccessibilityServiceList(android.accessibilityservice.AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
            .any { it.resolveInfo.serviceInfo.packageName == activity.packageName }
    }

    private fun usageAccessGranted(activity: Activity): Boolean {
        val appOps = activity.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager ?: return false
        @Suppress("DEPRECATION")
        val mode = if (Build.VERSION.SDK_INT >= 29) appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), activity.packageName)
            else appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), activity.packageName)
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun openCapability(activity: Activity, capability: Capability) {
        val missing = capability.permissions.filter { ContextCompat.checkSelfPermission(activity, it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) {
            activity.requestPermissions(missing.toTypedArray(), REQUEST_PERMISSION)
            return
        }
        val action = capability.settingsAction ?: return
        val intent = Intent(action).apply {
            if (action == Settings.ACTION_MANAGE_OVERLAY_PERMISSION ||
                action == Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION ||
                action == Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM ||
                action == Settings.ACTION_MANAGE_WRITE_SETTINGS ||
                action == Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS ||
                action == Settings.ACTION_APPLICATION_DETAILS_SETTINGS) {
                data = Uri.parse("package:${activity.packageName}")
            }
        }
        try { activity.startActivity(intent) } catch (_: Exception) {
            try { activity.startActivity(Intent(Settings.ACTION_SETTINGS)) } catch (_: Exception) { }
        }
    }

    private const val REQUEST_PERMISSION = 7401
}
