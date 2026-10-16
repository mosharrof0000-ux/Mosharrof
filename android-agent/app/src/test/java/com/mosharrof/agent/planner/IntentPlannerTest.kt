package com.mosharrof.agent.planner

import com.mosharrof.agent.planner.IntentPlanner.PlanResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class IntentPlannerTest {
    private val planner = IntentPlanner(
        mapOf(
            "youtube" to "com.google.android.youtube",
            "ইউটিউব" to "com.google.android.youtube"
        )
    )

    @Test
    fun explicitKnownAppProducesTypedAction() {
        val result = planner.plan("Open YouTube")
        assertTrue(result is PlanResult.Action)
        assertEquals(
            "com.google.android.youtube",
            (result as PlanResult.Action).action.targetPackage
        )
    }

    @Test
    fun BengaliKnownAppProducesTypedAction() {
        val result = planner.plan("ওপেন ইউটিউব")
        assertTrue(result is PlanResult.Action)
    }

    @Test
    fun settingsUsesDedicatedSystemIntentPlan() {
        assertEquals(PlanResult.OpenSystemSettings, planner.plan("সেটিংস খোলো"))
    }

    @Test
    fun unknownAppDoesNotGuessPackage() {
        assertTrue(planner.plan("open secret app") is PlanResult.NeedsClarification)
    }

    @Test
    fun unsupportedCommandFailsClosed() {
        assertTrue(planner.plan("send a message to everyone") is PlanResult.NeedsClarification)
    }

    @Test
    fun blankCommandRequestsInput() {
        assertTrue(planner.plan("   ") is PlanResult.NeedsClarification)
    }
}
