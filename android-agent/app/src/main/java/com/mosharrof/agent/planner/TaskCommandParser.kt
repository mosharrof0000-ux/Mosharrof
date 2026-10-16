package com.mosharrof.agent.planner

/** Parses a bounded command vocabulary; unknown requests never trigger actions. */
class TaskCommandParser {
    fun parse(rawCommand: String): TaskParsedCommand {
        val command = rawCommand.trim().lowercase()
        if (command.isEmpty()) return TaskParsedCommand.Unknown("কোনো নির্দেশ দেওয়া হয়নি")
        return when {
            command in OPEN_SETTINGS -> TaskParsedCommand.OpenSystemSettings
            command in OPEN_WIFI -> TaskParsedCommand.OpenSettingPanel(AgentAction.SupportedSetting.WIFI_PANEL)
            command in OPEN_BLUETOOTH -> TaskParsedCommand.OpenSettingPanel(AgentAction.SupportedSetting.BLUETOOTH_PANEL)
            command in OPEN_LOCATION -> TaskParsedCommand.OpenSettingPanel(AgentAction.SupportedSetting.LOCATION_SETTINGS)
            command in STOP -> TaskParsedCommand.Stop
            else -> TaskParsedCommand.Unknown("নির্দেশটি এখনো সমর্থিত নয়; কোনো কাজ করা হয়নি")
        }
    }

    private companion object {
        val OPEN_SETTINGS = setOf("open settings", "settings খোলো", "সেটিংস খোলো", "সেটিংস খুলুন")
        val OPEN_WIFI = setOf("open wifi settings", "wifi settings খোলো", "ওয়াইফাই সেটিংস খোলো", "ওয়াইফাই চালু করো")
        val OPEN_BLUETOOTH = setOf("open bluetooth settings", "bluetooth settings খোলো", "ব্লুটুথ সেটিংস খোলো")
        val OPEN_LOCATION = setOf("open location settings", "location settings খোলো", "লোকেশন সেটিংস খোলো")
        val STOP = setOf("stop", "থামো", "বন্ধ করো", "কাজ বন্ধ করো")
    }
}

sealed interface TaskParsedCommand {
    data object OpenSystemSettings : TaskParsedCommand
    data class OpenSettingPanel(val setting: AgentAction.SupportedSetting) : TaskParsedCommand
    data object Stop : TaskParsedCommand
    data class Unknown(val reason: String) : TaskParsedCommand
}
