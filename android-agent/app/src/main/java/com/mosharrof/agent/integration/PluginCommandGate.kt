package com.mosharrof.agent.integration

/**
 * Pure local validation for commands arriving through an integration adapter.
 * A decision of ALLOW means only that the request is structurally safe and
 * locally approved; the Android executor must still verify the live target,
 * permission state, supported package and postcondition.
 */
object PluginCommandGate {
    enum class Decision { ALLOW, NEEDS_CONFIRMATION, REJECT }

    private val riskyLabels = setOf(
        "send", "submit", "delete", "remove", "pay", "purchase",
        "install", "uninstall", "share", "post", "confirm", "transfer"
    )

    fun evaluate(
        command: PluginCommand,
        approval: LocalApproval? = null
    ): Decision {
        if (command.requestId.isBlank() || command.requestId.length > 128) {
            return Decision.REJECT
        }

        val shapeIsValid = when (command.action) {
            ControlAction.OPEN_APP ->
                validTarget(command.targetApp) &&
                    command.exactLabel == null && command.swipeDirection == null

            ControlAction.INSPECT_SCREEN ->
                command.targetApp == null && command.exactLabel == null &&
                    command.swipeDirection == null

            ControlAction.NAVIGATE_BACK ->
                command.targetApp == null && command.exactLabel == null &&
                    command.swipeDirection == null

            ControlAction.TAP_EXACT_LABEL ->
                validTarget(command.targetApp) && validLabel(command.exactLabel) &&
                    command.swipeDirection == null &&
                    !isRiskyLabel(command.exactLabel)

            ControlAction.SWIPE ->
                validTarget(command.targetApp) && command.swipeDirection != null &&
                    command.exactLabel == null
        }
        if (!shapeIsValid) return Decision.REJECT

        return if (approval?.requestId == command.requestId) {
            Decision.ALLOW
        } else {
            Decision.NEEDS_CONFIRMATION
        }
    }

    private fun validTarget(value: String?): Boolean =
        !value.isNullOrBlank() && value.length <= 120

    private fun validLabel(value: String?): Boolean =
        !value.isNullOrBlank() && value.length <= 100

    private fun isRiskyLabel(value: String?): Boolean {
        val normalized = value?.trim()?.lowercase() ?: return true
        return normalized in riskyLabels ||
            riskyLabels.any { risky ->
                normalized.startsWith("$risky ") || normalized.endsWith(" $risky")
            }
    }
}
