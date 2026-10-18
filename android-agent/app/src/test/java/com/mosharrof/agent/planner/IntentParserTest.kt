package com.mosharrof.agent.planner

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class IntentParserTest {
    private val parser = IntentParser()

    @Test fun parsesEnglishOpenCommand() {
        assertEquals(ParsedIntent.OpenApp("YouTube"), parser.parse("open YouTube"))
    }

    @Test fun parsesBengaliOpenCommand() {
        assertEquals(ParsedIntent.OpenApp("ইউটিউব"), parser.parse("ইউটিউব খুলুন"))
    }

    @Test fun parsesExplicitEnglishSwipeCommand() {
        assertEquals(ParsedIntent.Swipe(AgentAction.Direction.DOWN, "YouTube"), parser.parse("scroll down in YouTube"))
    }

    @Test fun parsesExplicitBengaliSwipeCommand() {
        assertEquals(ParsedIntent.Swipe(AgentAction.Direction.UP, "ইউটিউবে"), parser.parse("ইউটিউবে উপরে স্ক্রল করুন"))
    }

    @Test fun parsesQuotedEnglishTextEntry() {
        assertEquals(
            ParsedIntent.TypeText("hello there", "WhatsApp"),
            parser.parse("""type "hello there" in WhatsApp""")
        )
    }

    @Test fun parsesQuotedBengaliTextEntry() {
        assertEquals(
            ParsedIntent.TypeText("হ্যালো", "হোয়াটসঅ্যাপ"),
            parser.parse("""হোয়াটসঅ্যাপ-এ "হ্যালো" লিখুন""")
        )
    }

    @Test fun rejectsUnquotedTextEntry() {
        assertTrue(parser.parse("type hello in WhatsApp").isUnsupported())
    }

    @Test fun rejectsUnboundedOrAmbiguousCommand() {
        assertTrue(parser.parse("send a message to everyone").isUnsupported())
        assertTrue(parser.parse("x".repeat(IntentParser.MAX_COMMAND_LENGTH + 1)).isUnsupported())
    }

    private fun ParsedIntent.isUnsupported(): Boolean = this is ParsedIntent.Unsupported
}
