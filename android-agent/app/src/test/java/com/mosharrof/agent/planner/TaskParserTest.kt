package com.mosharrof.agent.planner

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TaskParserTest {
    private val parser = TaskParser(
        mapOf("নোটস" to "com.example.notes", "notes" to "com.example.notes")
    )

    @Test
    fun parsesScreenInspectionWithoutSideEffects() {
        val result = parser.parse("স্ক্রিন পরীক্ষা")
        assertTrue(result is TaskParseResult.Proposed)
        assertTrue((result as TaskParseResult.Proposed).action is AgentAction.InspectScreen)
    }

    @Test
    fun onlyOpensExplicitlyMappedApps() {
        val result = parser.parse("খোলো নোটস") as TaskParseResult.Proposed
        val action = result.action as AgentAction.OpenApp
        assertEquals("com.example.notes", action.packageName)
        assertTrue(action.userRequested)
    }

    @Test
    fun unknownAppRequiresClarification() {
        assertTrue(parser.parse("open banking") is TaskParseResult.NeedsClarification)
    }

    @Test
    fun destructiveOrExternalActionIsNeverExecuted() {
        assertTrue(parser.parse("send message") is TaskParseResult.NeedsClarification)
    }

    @Test
    fun unknownCommandIsUnsupported() {
        assertTrue(parser.parse("do something clever") is TaskParseResult.Unsupported)
    }

    @Test
    fun blankCommandAsksForInput() {
        assertTrue(parser.parse("  ") is TaskParseResult.NeedsClarification)
    }
}
