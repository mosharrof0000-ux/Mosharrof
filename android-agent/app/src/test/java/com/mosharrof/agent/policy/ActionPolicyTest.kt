package com.mosharrof.agent.policy

import com.mosharrof.agent.planner.AgentAction
import org.junit.Assert.assertEquals
import org.junit.Test

class ActionPolicyTest {
    private val policy = ActionPolicy(setOf("com.example.notes"), maxActionsPerTask = 3)

    @Test
    fun explicitlyRequestedAllowlistedAppCanOpen() {
        val result = policy.evaluate(AgentAction.OpenApp("com.example.notes", true), 0)
        assertEquals(PolicyDecision.ALLOW, result.decision)
    }

    @Test
    fun nonAllowlistedAppIsDenied() {
        val result = policy.evaluate(AgentAction.OpenApp("com.example.bank", true), 0)
        assertEquals(PolicyDecision.DENY, result.decision)
    }

    @Test
    fun ambiguousTapIsDenied() {
        val result = policy.evaluate(AgentAction.TapSemanticNode("com.example.notes"), 0)
        assertEquals(PolicyDecision.DENY, result.decision)
    }

    @Test
    fun semanticTapRequiresConfirmation() {
        val result = policy.evaluate(
            AgentAction.TapSemanticNode("com.example.notes", visibleText = "Save"),
            0
        )
        assertEquals(PolicyDecision.REQUIRE_CONFIRMATION, result.decision)
    }

    @Test
    fun globalNavigationRequiresConfirmation() {
        val result = policy.evaluate(
            AgentAction.GlobalNavigation(AgentAction.NavigationDestination.HOME),
            0
        )
        assertEquals(PolicyDecision.REQUIRE_CONFIRMATION, result.decision)
    }

    @Test
    fun actionBudgetIsFailClosed() {
        val result = policy.evaluate(AgentAction.OpenApp("com.example.notes", true), 3)
        assertEquals(PolicyDecision.DENY, result.decision)
    }

    @Test
    fun systemSettingsAlwaysRequireConfirmation() {
        val result = policy.evaluate(
            AgentAction.ToggleSystemSetting(AgentAction.SupportedSetting.LOCATION_SETTINGS, true),
            0
        )
        assertEquals(PolicyDecision.REQUIRE_CONFIRMATION, result.decision)
    }
}
