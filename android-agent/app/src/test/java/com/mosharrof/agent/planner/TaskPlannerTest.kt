package com.mosharrof.agent.planner

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TaskPlannerTest {
    private val planner = TaskPlanner()
    private val apps = listOf(
        InstalledApp("YouTube", "com.google.android.youtube"),
        InstalledApp("YouTube Music", "com.google.android.apps.youtube.music"),
        InstalledApp("Settings", "com.android.settings")
    )

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
