package com.mosharrof.agent.planner

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DeviceIntentRequestTest {
    @Test fun parsesDialRequest() {
        assertEquals(DeviceIntentRequest( DeviceIntentRequest.Kind.DIAL, target = "+8801712345678"), DeviceIntentRequest.parse("call +8801712345678"))
    }

    @Test fun parsesSmsWithBoundedBody() {
        assertEquals(DeviceIntentRequest(DeviceIntentRequest.Kind.COMPOSE_SMS, target = "01712345678", text = "আমি আসছি"), DeviceIntentRequest.parse("sms 01712345678 আমি আসছি"))
        assertNull(DeviceIntentRequest.parse("sms 01712345678 " + "x".repeat(501)))
    }

    @Test fun timerIsBoundedToOneDay() {
        assertEquals(86400, DeviceIntentRequest.parse("timer 24 hours")?.seconds)
        assertNull(DeviceIntentRequest.parse("timer 25 hours"))
    }

    @Test fun calendarTitleIsBounded() {
        assertEquals(DeviceIntentRequest.Kind.CREATE_CALENDAR_EVENT, DeviceIntentRequest.parse("calendar appointment")?.kind)
        assertNull(DeviceIntentRequest.parse("calendar " + "x".repeat(121)))
    }

    @Test fun unsupportedCommandIsNotReinterpretedAsSystemIntent() {
        assertNull(DeviceIntentRequest.parse("wipe all data"))
    }
}
