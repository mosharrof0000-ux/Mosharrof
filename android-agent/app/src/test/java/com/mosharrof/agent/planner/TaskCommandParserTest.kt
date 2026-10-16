package com.mosharrof.agent.planner

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TaskCommandParserTest {
    private val parser = TaskCommandParser()

    @Test
    fun parsesBengaliWifiRequest() {
        assertEquals(TaskParsedCommand.OpenSettingPanel(AgentAction.SupportedSetting.WIFI_PANEL), parser.parse("ওয়াইফাই সেটিংস খোলো"))
    }

    @Test
    fun parsesEnglishBluetoothRequest() {
        assertEquals(TaskParsedCommand.OpenSettingPanel(AgentAction.SupportedSetting.BLUETOOTH_PANEL), parser.parse("open bluetooth settings"))
    }

    @Test
    fun parsesStopCommand() {
        assertEquals(TaskParsedCommand.Stop, parser.parse("থামো"))
    }

    @Test
    fun unknownCommandsNeverBecomeExecutableActions() {
        assertTrue(parser.parse("send all my messages to someone").isUnknown())
    }

    @Test
    fun blankCommandIsRejected() {
        assertTrue(parser.parse("   ").isUnknown())
    }

    private fun TaskParsedCommand.isUnknown() = this is TaskParsedCommand.Unknown
}
