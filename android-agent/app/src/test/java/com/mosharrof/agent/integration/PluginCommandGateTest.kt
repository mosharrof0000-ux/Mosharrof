package com.mosharrof.agent.integration

import org.junit.Assert.assertEquals
import org.junit.Test

class PluginCommandGateTest {
    @Test
    fun validCommandRequiresVisibleLocalApproval() {
        val command = PluginCommand(
            requestId = "req-1",
            action = ControlAction.OPEN_APP,
            targetApp = "Settings"
        )

        assertEquals(
            PluginCommandGate.Decision.NEEDS_CONFIRMATION,
            PluginCommandGate.evaluate(command)
        )
        assertEquals(
            PluginCommandGate.Decision.ALLOW,
            PluginCommandGate.evaluate(command, LocalApproval("req-1"))
        )
    }

    @Test
    fun approvalForDifferentRequestCannotAuthorizeCommand() {
        val command = PluginCommand("req-2", ControlAction.NAVIGATE_BACK)

        assertEquals(
            PluginCommandGate.Decision.NEEDS_CONFIRMATION,
            PluginCommandGate.evaluate(command, LocalApproval("req-other"))
        )
    }

    @Test
    fun malformedOrOverlongTargetsAreRejected() {
        assertEquals(
            PluginCommandGate.Decision.REJECT,
            PluginCommandGate.evaluate(
                PluginCommand(" ", ControlAction.OPEN_APP, targetApp = "Settings")
            )
        )
        assertEquals(
            PluginCommandGate.Decision.REJECT,
            PluginCommandGate.evaluate(
                PluginCommand("req", ControlAction.OPEN_APP, targetApp = "x".repeat(121))
            )
        )
    }

    @Test
    fun dangerousExactLabelsAreRejectedEvenWithApproval() {
        val command = PluginCommand(
            requestId = "req-send",
            action = ControlAction.TAP_EXACT_LABEL,
            targetApp = "Messages",
            exactLabel = "Send"
        )

        assertEquals(
            PluginCommandGate.Decision.REJECT,
            PluginCommandGate.evaluate(command, LocalApproval("req-send"))
        )
    }

    @Test
    fun actionCannotSmuggleUnexpectedParameters() {
        val command = PluginCommand(
            requestId = "req-back",
            action = ControlAction.NAVIGATE_BACK,
            targetApp = "Settings"
        )

        assertEquals(
            PluginCommandGate.Decision.REJECT,
            PluginCommandGate.evaluate(command, LocalApproval("req-back"))
        )
    }

    @Test
    fun tapRequiresExactLabelAndTarget() {
        assertEquals(
            PluginCommandGate.Decision.REJECT,
            PluginCommandGate.evaluate(
                PluginCommand("req-tap", ControlAction.TAP_EXACT_LABEL, targetApp = "Settings")
            )
        )
    }
}
