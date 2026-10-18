package com.mosharrof.agent.planner

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DeviceIntentCommandParserTest {
    @Test fun parsesEnglishTimer() {
        assertEquals(DeviceIntentCommand.SetTimer(600), DeviceIntentCommandParser.parse("set timer for 10 minutes"))
    }

    @Test fun parsesBengaliDigitTimerBeforeNoun() {
        assertEquals(DeviceIntentCommand.SetTimer(600), DeviceIntentCommandParser.parse("১০ মিনিটের টাইমার"))
    }

    @Test fun parsesBengaliDigitAlarm() {
        assertEquals(DeviceIntentCommand.SetAlarm(7, 5), DeviceIntentCommandParser.parse("অ্যালার্ম ০৭:০৫"))
    }

    @Test fun parsesCalendarEventTomorrow() {
        assertEquals(
            DeviceIntentCommand.CreateCalendarEvent("ডাক্তারের অ্যাপয়েন্টমেন্ট", 1, 9, 30),
            DeviceIntentCommandParser.parse("calendar event ডাক্তারের অ্যাপয়েন্টমেন্ট tomorrow at 9:30")
        )
    }

    @Test fun parsesExplicitIsoDateForCalendarEvent() {
        assertEquals(
            DeviceIntentCommand.CreateCalendarEvent("meeting", 0, 18, 45, "2026-10-25"),
            DeviceIntentCommandParser.parse("calendar event meeting 2026-10-25 at 18:45")
        )
    }

    @Test fun parsesBanglaDigitDateAndTime() {
        assertEquals(
            DeviceIntentCommand.CreateCalendarEvent("মিটিং", 0, 9, 15, "2026-10-25"),
            DeviceIntentCommandParser.parse("ক্যালেন্ডার ইভেন্ট মিটিং ২৫/১০/২০২৬ ০৯:১৫")
        )
    }

    @Test fun rejectsInvalidCalendarDate() {
        assertNull(DeviceIntentCommandParser.parse("calendar event meeting 2026-02-31 at 18:45"))
    }

    @Test fun rejectsInvalidTimesAndLongTimers() {
        assertNull(DeviceIntentCommandParser.parse("alarm 29:90"))
        assertNull(DeviceIntentCommandParser.parse("timer 90000 seconds"))
    }

    @Test fun ignoresUnrelatedCommands() {
        assertNull(DeviceIntentCommandParser.parse("open YouTube"))
    }
}
