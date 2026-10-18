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
    fun expiredLocalApprovalCannotAuthorizeACommand() {
        val command = PluginCommand(
            requestId = "req-expired",
            action = ControlAction.OPEN_APP,
            targetApp = "Settings"
        )
        val expired = LocalApproval("req-expired", expiresAtEpochMillis = 999L)

        assertEquals(
            PluginCommandGate.Decision.NEEDS_CONFIRMATION,
            PluginCommandGate.evaluate(command, expired, nowMillis = 1_000L)
        )
    }

    @Test
    fun dangerousBengaliLabelsAreRejectedEvenWithApproval() {
        listOf("পাঠান", "মুছে ফেলুন", "টাকা পাঠান", "পেমেন্ট", "শেয়ার").forEachIndexed { index, label ->
            val requestId = "req-bn-$index"
            val command = PluginCommand(
                requestId = requestId,
                action = ControlAction.TAP_EXACT_LABEL,
                targetApp = "Messages",
                exactLabel = label
            )
            assertEquals(
                "Expected Bengali risky label to be rejected: $label",
                PluginCommandGate.Decision.REJECT,
                PluginCommandGate.evaluate(command, LocalApproval(requestId))
            )
        }
    }

    @Test
    fun controlCharactersAreRejectedFromRequestAndLabels() {
        assertEquals(
            PluginCommandGate.Decision.REJECT,
            PluginCommandGate.evaluate(
                PluginCommand("req\\n-1", ControlAction.NAVIGATE_BACK)
            )
        )
        assertEquals(
            PluginCommandGate.Decision.REJECT,
            PluginCommandGate.evaluate(
                PluginCommand(
                    "req-label",
                    ControlAction.TAP_EXACT_LABEL,
                    targetApp = "Messages",
                    exactLabel = "Open\\u0000Messages"
                )
            )
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
