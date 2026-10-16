package com.mosharrof.agent.planner

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TaskIntentParserTest {
    private val parser = TaskIntentParser()

    @Test
    fun recognizesBengaliSettingsCommand() {
        assertEquals(TaskIntent.OPEN_SETTINGS, parser.parse("সেটিংস খোলো").intent)
    }

    @Test
    fun recognizesEnglishAccessibilityCommand() {
        assertEquals(
            TaskIntent.OPEN_ACCESSIBILITY_SETTINGS,
            parser.parse("  Open Accessibility Settings ").intent
        )
    }

    @Test
    fun screenInspectionRequiresConfirmation() {
        val task = parser.parse("বর্তমান স্ক্রিন স্ক্যান করো")
        assertEquals(TaskIntent.INSPECT_CURRENT_SCREEN, task.intent)
        assertTrue(task.requiresConfirmation)
    }

    @Test
    fun unknownCommandFailsClosed() {
        val task = parser.parse("send every message automatically")
        assertEquals(TaskIntent.UNSUPPORTED, task.intent)
        assertTrue(task.requiresConfirmation)
    }

    @Test
    fun blankCommandDoesNotBecomeAnAction() {
        assertEquals(TaskIntent.UNSUPPORTED, parser.parse("  ").intent)
    }
}
