package com.mosharrof.agent.planner

import org.junit.Assert.assertEquals
import org.junit.Test

class VoiceCommandParserTest {
    private val parser = VoiceCommandParser()

    @Test
    fun parsesBengaliSettingsCommand() {
        assertEquals(AgentIntent.OpenApp("settings"), parser.parse("সেটিংস খোলো"))
    }

    @Test
    fun parsesEnglishCameraCommand() {
        assertEquals(AgentIntent.OpenApp("camera"), parser.parse("Open Camera"))
    }

    @Test
    fun parsesSearchQuery() {
        assertEquals(AgentIntent.SearchWeb("বাংলা আবহাওয়া"), parser.parse("খুঁজে দেখো বাংলা আবহাওয়া"))
    }

    @Test
    fun emptySearchIsRejected() {
        assertEquals(
            AgentIntent.Unknown("missing_search_query"),
            parser.parse("search for ")
        )
    }

    @Test
    fun unknownCommandDoesNotBecomeAnAction() {
        assertEquals(
            AgentIntent.Unknown("unrecognized_command"),
            parser.parse("delete all my messages")
        )
    }
}
