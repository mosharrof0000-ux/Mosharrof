package com.mosharrof.agent.planner

/**
 * Converts a small, explicit command vocabulary into typed proposals.
 * It does not execute actions or infer targets from arbitrary text.
 */
class CommandParser {
    fun parse(command: String): ParsedCommand {
        val normalized = command.trim()
            .lowercase()
            .replace(Regex("\\s+"), " ")

        if (normalized.isBlank()) return ParsedCommand.Unknown

        return when (normalized) {
            "open settings", "settings খুলুন", "সেটিংস খুলুন" ->
                ParsedCommand.OpenSystemSettings
            "wifi settings", "open wifi settings", "ওয়াইফাই সেটিংস খুলুন",
            "ওয়াইফাই সেটিংস খুলুন" -> ParsedCommand.OpenSettingPanel(
                AgentAction.SupportedSetting.WIFI_PANEL
            )
            "bluetooth settings", "open bluetooth settings", "ব্লুটুথ সেটিংস খুলুন" ->
                ParsedCommand.OpenSettingPanel(AgentAction.SupportedSetting.BLUETOOTH_PANEL)
            "location settings", "open location settings", "লোকেশন সেটিংস খুলুন" ->
                ParsedCommand.OpenSettingPanel(
                    AgentAction.SupportedSetting.LOCATION_SETTINGS
                )
            else -> parseExplicitAppLaunch(normalized)
        }
    }

    private fun parseExplicitAppLaunch(command: String): ParsedCommand {
        val packageName = when {
            command.startsWith("open app ") -> command.removePrefix("open app ").trim()
            command.startsWith("অ্যাপ খুলুন ") -> command.removePrefix("অ্যাপ খুলুন ").trim()
            else -> return ParsedCommand.Unknown
        }
        if (!PACKAGE_PATTERN.matches(packageName)) return ParsedCommand.Unknown
        return ParsedCommand.OpenApp(packageName)
    }

    private companion object {
        val PACKAGE_PATTERN = Regex("[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+")
    }
}

sealed interface ParsedCommand {
    data object Unknown : ParsedCommand
    data object OpenSystemSettings : ParsedCommand
    data class OpenSettingPanel(
        val setting: AgentAction.SupportedSetting
    ) : ParsedCommand
    data class OpenApp(val packageName: String) : ParsedCommand
}
