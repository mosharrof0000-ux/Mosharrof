package com.mosharrof.agent.planner

/** Parses a small, explicit vocabulary into commands; unknown requests fail closed. */
class CommandParser {
    fun parse(rawCommand: String): ParsedCommand {
        val command = rawCommand.trim().lowercase().replace(Regex("\\s+"), " ")
        if (command.isBlank() || command.length > MAX_COMMAND_LENGTH) {
            return ParsedCommand.Unknown
        }

        return when (command) {
            "open settings", "সেটিংস খোলো", "সেটিংস খুলুন" ->
                ParsedCommand.OpenSystemSettings
            "open wifi settings", "ওয়াইফাই সেটিংস খুলুন", "ওয়াইফাই সেটিংস খুলুন" ->
                ParsedCommand.OpenSettingPanel(AgentAction.SupportedSetting.WIFI_PANEL)
            "open bluetooth settings", "ব্লুটুথ সেটিংস খুলুন" ->
                ParsedCommand.OpenSettingPanel(AgentAction.SupportedSetting.BLUETOOTH_PANEL)
            "open location settings", "লোকেশন সেটিংস খুলুন" ->
                ParsedCommand.OpenSettingPanel(AgentAction.SupportedSetting.LOCATION_SETTINGS)
            else -> parseExplicitApp(command)
        }
    }

    private fun parseExplicitApp(command: String): ParsedCommand {
        val prefix = "open app "
        if (!command.startsWith(prefix)) return ParsedCommand.Unknown
        val packageName = command.removePrefix(prefix).trim()
        if (!PACKAGE_PATTERN.matches(packageName)) return ParsedCommand.Unknown
        return ParsedCommand.OpenApp(packageName)
    }

    companion object {
        private const val MAX_COMMAND_LENGTH = 240
        private val PACKAGE_PATTERN =
            Regex("[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+")
    }
}

sealed interface ParsedCommand {
    data object Unknown : ParsedCommand
    data object OpenSystemSettings : ParsedCommand
    data class OpenSettingPanel(val setting: AgentAction.SupportedSetting) : ParsedCommand
    data class OpenApp(val packageName: String) : ParsedCommand
}
