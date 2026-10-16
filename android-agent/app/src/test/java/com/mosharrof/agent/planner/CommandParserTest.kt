package com.mosharrof.agent.planner

import com.mosharrof.agent.planner.AgentAction.SupportedSetting
import org.junit.Assert.assertEquals
import org.junit.Test

class CommandParserTest {
    private val parser = CommandParser()

    @Test
    fun recognizesBengaliWifiCommand() {
        assertEquals(ParsedCommand.OpenSettingPanel(SupportedSetting.WIFI_PANEL),
            parser.parse("ওয়াইফাই সেটিংস খুলুন"))
    }

    @Test
    fun recognizesBluetoothCommand() {
        assertEquals(ParsedCommand.OpenSettingPanel(SupportedSetting.BLUETOOTH_PANEL),
            parser.parse("open bluetooth settings"))
    }

    @Test
    fun parsesExplicitPackageLaunchOnly() {
        assertEquals(ParsedCommand.OpenApp("com.example.notes"),
            parser.parse("open app com.example.notes"))
    }

    @Test
    fun rejectsPackageWithCommandInjectionText() {
        assertEquals(ParsedCommand.Unknown,
            parser.parse("open app com.example.notes; rm -rf"))
    }

    @Test
    fun rejectsUnrecognizedNaturalLanguageInsteadOfGuessing() {
        assertEquals(ParsedCommand.Unknown, parser.parse("send the message now"))
    }

    @Test
    fun blankCommandIsUnknown() {
        assertEquals(ParsedCommand.Unknown, parser.parse("  "))
    }
}
