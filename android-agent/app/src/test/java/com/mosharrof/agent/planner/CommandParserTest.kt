package com.mosharrof.agent.planner

import org.junit.Assert.assertEquals
import org.junit.Test

class CommandParserTest {
    private val parser = CommandParser()

    @Test
    fun parsesEnglishSettingsCommand() {
        assertEquals(ParsedCommand.OpenSystemSettings, parser.parse("open settings"))
    }

    @Test
    fun parsesBengaliWifiCommand() {
        assertEquals(
            ParsedCommand.OpenSettingPanel(AgentAction.SupportedSetting.WIFI_PANEL),
            parser.parse("ওয়াইফাই সেটিংস খুলুন")
        )
    }

    @Test
    fun parsesExplicitPackageLaunch() {
        assertEquals(
            ParsedCommand.OpenApp("com.example.notes"),
            parser.parse("open app com.example.notes")
        )
    }

    @Test
    fun parsesAdditionalSafeSettingsCommands() {
        listOf(
            "open display settings" to AgentAction.SupportedSetting.DISPLAY_SETTINGS,
            "সাউন্ড সেটিংস খুলুন" to AgentAction.SupportedSetting.SOUND_SETTINGS,
            "ব্যাটারি সেভার সেটিংস খুলুন" to AgentAction.SupportedSetting.BATTERY_SAVER_SETTINGS,
            "নোটিফিকেশন সেটিংস খুলুন" to AgentAction.SupportedSetting.NOTIFICATION_SETTINGS,
            "অ্যাপ সেটিংস খুলুন" to AgentAction.SupportedSetting.APPLICATION_SETTINGS
        ).forEach { (command, setting) ->
            assertEquals(ParsedCommand.OpenSettingPanel(setting), parser.parse(command))
        }
    }

    @Test
    fun parsesConfirmedNavigationCommands() {
        listOf(
            "go back" to AgentAction.NavigationDestination.BACK,
            "হোমে যান" to AgentAction.NavigationDestination.HOME,
            "নোটিফিকেশন খুলুন" to AgentAction.NavigationDestination.NOTIFICATIONS,
            "recent apps" to AgentAction.NavigationDestination.RECENTS
        ).forEach { (command, destination) ->
            assertEquals(ParsedCommand.GlobalNavigation(destination), parser.parse(command))
        }
    }

    @Test
    fun rejectsAmbiguousAppName() {
        assertEquals(ParsedCommand.Unknown, parser.parse("open app notes"))
    }

    @Test
    fun rejectsEmptyCommand() {
        assertEquals(ParsedCommand.Unknown, parser.parse("  "))
    }
}
