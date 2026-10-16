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
    fun rejectsAmbiguousAppName() {
        assertEquals(ParsedCommand.Unknown, parser.parse("open app notes"))
    }

    @Test
    fun rejectsEmptyCommand() {
        assertEquals(ParsedCommand.Unknown, parser.parse("  "))
    }
}
