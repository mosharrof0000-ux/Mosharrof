package com.mosharrof.agent.execution

import android.content.Context
import android.content.Intent
import android.provider.Settings
import com.mosharrof.agent.planner.AgentAction
import com.mosharrof.agent.planner.ParsedCommand

/** Executes only parser-approved Settings intents; it never changes a setting silently. */
class CommandLauncher(private val context: Context) {
    fun launch(command: ParsedCommand): LaunchResult = when (command) {
        ParsedCommand.OpenSystemSettings -> open(Settings.ACTION_SETTINGS, "Android Settings খোলা হয়েছে")
        is ParsedCommand.OpenSettingPanel -> open(
            actionFor(command.setting),
            "নির্বাচিত সেটিংস প্যানেল খোলা হয়েছে"
        )
        ParsedCommand.Stop -> LaunchResult.Stopped("কোনো চলমান কাজ নেই; নতুন নির্দেশ বন্ধ রাখা হয়েছে")
        is ParsedCommand.Unknown -> LaunchResult.Rejected(command.reason)
    }

    private fun actionFor(setting: AgentAction.SupportedSetting): String = when (setting) {
        AgentAction.SupportedSetting.WIFI_PANEL -> Settings.ACTION_WIFI_SETTINGS
        AgentAction.SupportedSetting.BLUETOOTH_PANEL -> Settings.ACTION_BLUETOOTH_SETTINGS
        AgentAction.SupportedSetting.LOCATION_SETTINGS -> Settings.ACTION_LOCATION_SOURCE_SETTINGS
    }

    private fun open(action: String, message: String): LaunchResult = try {
        context.startActivity(Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        LaunchResult.Opened(message)
    } catch (_: Exception) {
        LaunchResult.Rejected("এই ডিভাইসে অনুরোধ করা Settings প্যানেল খোলা যায়নি")
    }
}

sealed interface LaunchResult {
    data class Opened(val message: String) : LaunchResult
    data class Rejected(val reason: String) : LaunchResult
    data class Stopped(val message: String) : LaunchResult
}
