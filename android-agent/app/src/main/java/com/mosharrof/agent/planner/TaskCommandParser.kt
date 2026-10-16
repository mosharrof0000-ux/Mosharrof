package com.mosharrof.agent.planner

/** Parses only a small, explicit command vocabulary; unknown requests never trigger actions. */
class TaskCommandParser {
    fun parse(rawCommand: String): ParsedCommand {
        val command = rawCommand.trim().lowercase()
        if (command.isEmpty()) return ParsedCommand.Unknown("কোনো নির্দেশ দেওয়া হয়নি")

        return when {
            command in OPEN_SETTINGS -> ParsedCommand.OpenSystemSettings
            command in OPEN_WIFI -> ParsedCommand.OpenSettingPanel(AgentAction.SupportedSetting.WIFI_PANEL)
            command in OPEN_BLUETOOTH -> ParsedCommand.OpenSettingPanel(AgentAction.SupportedSetting.BLUETOOTH_PANEL)
            command in OPEN_LOCATION -> ParsedCommand.OpenSettingPanel(AgentAction.SupportedSetting.LOCATION_SETTINGS)
            command in STOP -> ParsedCommand.Stop
            else -> ParsedCommand.Unknown("নির্দেশটি এখনো সমর্থিত নয়; কোনো কাজ করা হয়নি")
        }
    }

    companion object {
        private val OPEN_SETTINGS = setOf("open settings", "settings খোলো", "সেটিংস খোলো", "সেটিংস খুলুন")
        private val OPEN_WIFI = setOf("open wifi settings", "wifi settings খোলো", "ওয়াইফাই সেটিংস খোলো", "ওয়াইফাই চালু করো")
        private val OPEN_BLUETOOTH = setOf("open bluetooth settings", "bluetooth settings খোলো", "ব্লুটুথ সেটিংস খোলো")
        private val OPEN_LOCATION = setOf("open location settings", "location settings খোলো", "লোকেশন সেটিংস খোলো")
        private val STOP = setOf("stop", "থামো", "বন্ধ করো", "কাজ বন্ধ করো")
    }
}

sealed interface ParsedCommand {
    data object OpenSystemSettings : ParsedCommand
    data class OpenSettingPanel(val setting: AgentAction.SupportedSetting) : ParsedCommand
    data object Stop : ParsedCommand
    data class Unknown(val reason: String) : ParsedCommand
}
