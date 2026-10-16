package com.mosharrof.agent.execution

import android.content.Context
import android.content.Intent
import android.provider.Settings
import com.mosharrof.agent.planner.AgentAction
import com.mosharrof.agent.planner.TaskPlan

/** Opens Android's own Settings screens; it never toggles settings silently. */
class SystemSettingsLauncher(private val context: Context) {
    fun launch(plan: TaskPlan): String {
        val target = when (plan) {
            TaskPlan.OpenSystemSettings -> Settings.ACTION_SETTINGS
            is TaskPlan.OpenSettingPanel -> settingsAction(plan.setting)
            else -> return "এই পরিকল্পনাটি Settings launcher সমর্থন করে না।"
        }
        return runCatching {
            context.startActivity(Intent(target).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            "Android Settings খোলা হয়েছে। পরিবর্তন করতে হলে সিস্টেম স্ক্রিনে নিজে নিশ্চিত করুন।"
        }.getOrElse { "Settings খোলা যায়নি: ${it.message ?: "অজানা সমস্যা"}" }
    }

    fun label(setting: AgentAction.SupportedSetting): String = when (setting) {
        AgentAction.SupportedSetting.WIFI_PANEL -> "Wi-Fi Settings"
        AgentAction.SupportedSetting.BLUETOOTH_PANEL -> "Bluetooth Settings"
        AgentAction.SupportedSetting.LOCATION_SETTINGS -> "Location Settings"
        AgentAction.SupportedSetting.DISPLAY_SETTINGS -> "Display Settings"
        AgentAction.SupportedSetting.SOUND_SETTINGS -> "Sound Settings"
        AgentAction.SupportedSetting.BATTERY_SAVER_SETTINGS -> "Battery Saver Settings"
        AgentAction.SupportedSetting.NOTIFICATION_SETTINGS -> "Notification Settings"
        AgentAction.SupportedSetting.APPLICATION_SETTINGS -> "Application Settings"
    }

    private fun settingsAction(setting: AgentAction.SupportedSetting): String = when (setting) {
        AgentAction.SupportedSetting.WIFI_PANEL -> Settings.ACTION_WIFI_SETTINGS
        AgentAction.SupportedSetting.BLUETOOTH_PANEL -> Settings.ACTION_BLUETOOTH_SETTINGS
        AgentAction.SupportedSetting.LOCATION_SETTINGS -> Settings.ACTION_LOCATION_SOURCE_SETTINGS
        AgentAction.SupportedSetting.DISPLAY_SETTINGS -> Settings.ACTION_DISPLAY_SETTINGS
        AgentAction.SupportedSetting.SOUND_SETTINGS -> Settings.ACTION_SOUND_SETTINGS
        AgentAction.SupportedSetting.BATTERY_SAVER_SETTINGS -> Settings.ACTION_BATTERY_SAVER_SETTINGS
        AgentAction.SupportedSetting.NOTIFICATION_SETTINGS -> "android.settings.APP_NOTIFICATION_SETTINGS"
        AgentAction.SupportedSetting.APPLICATION_SETTINGS -> Settings.ACTION_APPLICATION_SETTINGS
    }
}
