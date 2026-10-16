package com.mosharrof.agent.diagnostics

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.SystemClock
import android.os.Environment
import android.os.StatFs
import android.text.format.Formatter

/** Read-only, on-demand device diagnostics. Does not upload or persist device information. */
class DeviceDiagnostics(private val context: Context) {
    fun snapshot(): String {
        val battery = batterySummary()
        val storage = storageSummary()
        val network = networkSummary()
        val memory = memorySummary()
        val device = deviceSummary()
        return listOf("ডিভাইস পরীক্ষা", device, battery, storage, memory, network).joinToString("\n")
    }

    private fun memorySummary(): String {
        val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            ?: return "RAM: তথ্য পাওয়া যায়নি"
        val info = ActivityManager.MemoryInfo()
        manager.getMemoryInfo(info)
        val state = if (info.lowMemory) "RAM কম; ব্যাকগ্রাউন্ড অ্যাপ বন্ধ করা লাগতে পারে" else "RAM চাপের সতর্কতা নেই"
        return "RAM: ${Formatter.formatFileSize(context, info.availMem)} ফাঁকা / ${Formatter.formatFileSize(context, info.totalMem)} মোট • $state"
    }

    private fun deviceSummary(): String {
        val model = listOf(Build.MANUFACTURER, Build.MODEL).filter { it.isNotBlank() }.joinToString(" ")
        val uptimeMinutes = SystemClock.elapsedRealtime() / 60_000L
        return "ডিভাইস: ${model.ifBlank { "Android device" }} • Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT}) • রিবুটের পর চালু: ${uptimeMinutes / 60}ঘ ${uptimeMinutes % 60}মি"
    }
    private fun batterySummary(): String {
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            ?: return "ব্যাটারি: তথ্য পাওয়া যায়নি"
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        val percent = if (level >= 0 && scale > 0) level * 100 / scale else null
        val status = when (intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)) {
            BatteryManager.BATTERY_STATUS_CHARGING -> "চার্জ হচ্ছে"
            BatteryManager.BATTERY_STATUS_FULL -> "পূর্ণ"
            BatteryManager.BATTERY_STATUS_DISCHARGING -> "চার্জ হচ্ছে না"
            else -> "অজানা অবস্থা"
        }
        return "ব্যাটারি: ${percent?.let { "$it%" } ?: "অজানা"} • $status"
    }

    private fun storageSummary(): String = try {
        val stat = StatFs(Environment.getDataDirectory().absolutePath)
        val total = stat.totalBytes.coerceAtLeast(0L)
        val free = stat.availableBytes.coerceAtLeast(0L)
        "অভ্যন্তরীণ স্টোরেজ: ${Formatter.formatFileSize(context, free)} ফাঁকা / ${Formatter.formatFileSize(context, total)} মোট"
    } catch (_: Exception) {
        "স্টোরেজ: তথ্য পড়া যায়নি"
    }

    private fun networkSummary(): String {
        val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return "নেটওয়ার্ক: তথ্য পাওয়া যায়নি"
        val capabilities = manager.getNetworkCapabilities(manager.activeNetwork)
            ?: return "নেটওয়ার্ক: সংযোগ নেই"
        val kind = when {
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "Wi-Fi"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "মোবাইল ডেটা"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "Ethernet"
            else -> "অন্য নেটওয়ার্ক"
        }
        val internet = if (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) "ইন্টারনেট সক্ষম" else "ইন্টারনেট সক্ষম নয়"
        return "নেটওয়ার্ক: $kind • $internet"
    }
}
