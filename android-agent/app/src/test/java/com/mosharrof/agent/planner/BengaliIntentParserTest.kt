package com.mosharrof.agent.planner

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BengaliIntentParserTest {
    private val parser = BengaliIntentParser(
        mapOf("ক্যালকুলেটর" to "com.android.calculator2", "calculator" to "com.android.calculator2")
    )

    @Test
    fun parsesBengaliAppLaunch() {
        assertEquals(BengaliParsedIntent.OpenApp("com.android.calculator2"), parser.parse("ক্যালকুলেটর খুলে দাও"))
    }

    @Test
    fun parsesEnglishAppLaunch() {
        assertEquals(BengaliParsedIntent.OpenApp("com.android.calculator2"), parser.parse("Open calculator"))
    }

    @Test
    fun rejectsUnknownAppsWithoutGuessing() {
        assertTrue(parser.parse("ফেসবুক খুলে দাও") is BengaliParsedIntent.NeedsClarification)
    }

    @Test
    fun rejectsUnsupportedCommands() {
        assertTrue(parser.parse("আমার হয়ে সব কাজ করো") is BengaliParsedIntent.NeedsClarification)
    }

    @Test
    fun recognizesScreenInspection() {
        assertEquals(BengaliParsedIntent.InspectCurrentScreen, parser.parse("বর্তমান স্ক্রিন পরীক্ষা কর"))
    }

    @Test
    fun recognizesAccessibilitySettings() {
        assertEquals(BengaliParsedIntent.OpenAccessibilitySettings, parser.parse("অ্যাক্সেসিবিলিটি সেটিং খুল"))
    }

    @Test
    fun rejectsBlankInput() {
        assertTrue(parser.parse("   ") is BengaliParsedIntent.NeedsClarification)
    }
}
