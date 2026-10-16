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

    private fun settingsAction(setting: AgentAction.SupportedSetting): String = when (setting) {
        AgentAction.SupportedSetting.WIFI_PANEL -> Settings.ACTION_WIFI_SETTINGS
        AgentAction.SupportedSetting.BLUETOOTH_PANEL -> Settings.ACTION_BLUETOOTH_SETTINGS
        AgentAction.SupportedSetting.LOCATION_SETTINGS -> Settings.ACTION_LOCATION_SOURCE_SETTINGS
    }
}
