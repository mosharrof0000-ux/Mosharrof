package com.mosharrof.agent.planner

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TaskPlannerTest {
    private val planner = TaskPlanner()
    private val apps = listOf(
        InstalledApp("YouTube", "com.google.android.youtube"),
        InstalledApp("YouTube Music", "com.google.android.apps.youtube.music"),
        InstalledApp("Settings", "com.android.settings"),
        InstalledApp("WhatsApp", "com.whatsapp")
    )

    @Test fun plansDialerInsteadOfPlacingCallDirectly() {
        assertEquals(
            TaskPlan.SystemIntent(DeviceIntentRequest.Kind.DIAL, target = "01712345678"),
            planner.plan("call 01712345678", apps)
        )
    }

    @Test fun plansSmsDraftInsteadOfSendingDirectly() {
        assertEquals(
            TaskPlan.SystemIntent(DeviceIntentRequest.Kind.COMPOSE_SMS, target = "01712345678", text = "আমি আসছি"),
            planner.plan("sms 01712345678 আমি আসছি", apps)
        )
    }

    @Test fun plansAndroidTimerIntent() {
        assertEquals(
            TaskPlan.SystemIntent(DeviceIntentRequest.Kind.SET_TIMER, seconds = 600),
            planner.plan("timer 10 minutes", apps)
        )
    }

    @Test fun plansCalendarDraft() {
        assertEquals(
            TaskPlan.SystemIntent(DeviceIntentRequest.Kind.CREATE_CALENDAR_EVENT, text = "ডাক্তার দেখানো"),
            planner.plan("calendar ডাক্তার দেখানো", apps)
        )
    }

    @Test fun rejectsMalformedPhoneIntent() {
        assertTrue(planner.plan("call unknown", apps) is TaskPlan.Rejected)
    }

    @Test fun resolvesExactInstalledApp() {
        assertEquals(TaskPlan.OpenApp(apps[0]), planner.plan("open YouTube", apps))
    }

    @Test fun resolvesCommonBengaliAppAlias() {
        assertEquals(TaskPlan.OpenApp(apps[0]), planner.plan("ইউটিউব খুলুন", apps))
    }

    @Test fun resolvesBengaliSettingsCommand() {
        assertEquals(TaskPlan.OpenSystemSettings, planner.plan("সেটিংস খুলুন", apps))
    }

    @Test fun plansSystemSettingsOnlyWhenExplicitlyRequested() {
        assertEquals(TaskPlan.OpenSystemSettings, planner.plan("open settings", apps))
    }

    @Test fun plansWifiSettingsWithoutSilentlyChangingTheSetting() {
        assertEquals(
            TaskPlan.OpenSettingPanel(AgentAction.SupportedSetting.WIFI_PANEL),
            planner.plan("ওয়াইফাই সেটিংস খুলুন", apps)
        )
    }

    @Test fun resolvesExplicitInstalledPackage() {
        assertEquals(
            TaskPlan.OpenApp(apps[0]),
            planner.plan("open app com.google.android.youtube", apps)
        )
    }

    @Test fun plansTextEntryForAnExplicitTargetApp() {
        assertEquals(
            TaskPlan.TypeText("hello there", apps[3]),
            planner.plan("""type "hello there" in WhatsApp""", apps)
        )
    }

    @Test fun plansBengaliTextEntryForAnExplicitTargetApp() {
        assertEquals(
            TaskPlan.TypeText("হ্যালো", apps[3]),
            planner.plan("""হোয়াটসঅ্যাপ-এ "হ্যালো" লিখুন""", apps)
        )
    }

    @Test fun rejectsTextEntryWithoutAnExplicitTargetApp() {
        assertTrue(planner.plan("""type "hello there"""", apps) is TaskPlan.Rejected)
    }

    @Test fun plansSwipeOnlyForAnExplicitInstalledApp() {
        assertEquals(TaskPlan.SwipeScreen(AgentAction.Direction.DOWN, apps[0]), planner.plan("scroll down in YouTube", apps))
    }

    @Test fun asksForChoiceWhenNameIsPartial() {
        assertTrue(planner.plan("open You", apps) is TaskPlan.NeedsChoice)
    }

    @Test fun rejectsUnsupportedAction() {
        assertTrue(planner.plan("delete my messages", apps) is TaskPlan.Rejected)
    }

    @Test fun doesNotResolveUnknownApps() {
        assertTrue(planner.plan("open no-such-app", apps) is TaskPlan.Rejected)
    }
}
