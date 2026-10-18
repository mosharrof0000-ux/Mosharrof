package com.mosharrof.agent.integration

import java.util.Locale

/**
 * Pure local validation for commands arriving through an integration adapter.
 * A decision of ALLOW means only that the request is structurally safe and
 * locally approved; the Android executor must still verify the live target,
 * permission state, supported package and postcondition.
 */
object PluginCommandGate {
    enum class Decision { ALLOW, NEEDS_CONFIRMATION, REJECT }

    // Fail closed for common externally visible/destructive English and Bengali labels.
    private val riskyLabels = setOf(
        "send", "submit", "delete", "remove", "pay", "payment", "purchase",
        "install", "uninstall", "share", "post", "confirm", "transfer",
        "পাঠান", "পাঠিয়ে দিন", "জমা দিন", "সাবমিট", "মুছুন", "মুছে ফেলুন",
        "ডিলিট", "সরান", "পেমেন্ট", "পরিশোধ", "কিনুন", "ক্রয়", "ইনস্টল",
        "আনইনস্টল", "শেয়ার", "শেয়ার", "পোস্ট", "নিশ্চিত করুন", "নিশ্চিত",
        "স্থানান্তর", "টাকা পাঠান", "বার্তা পাঠান"
    )

    fun evaluate(
        command: PluginCommand,
        approval: LocalApproval? = null
    ): Decision {
        if (command.requestId.isBlank() || command.requestId.length > 128 ||
            command.requestId.any { it.isISOControl() }
        ) {
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
        !value.isNullOrBlank() && value.length <= 120 &&
            value.none { it.isISOControl() }

    private fun validLabel(value: String?): Boolean =
        !value.isNullOrBlank() && value.length <= 100 &&
            value.none { it.isISOControl() }

    private fun isRiskyLabel(value: String?): Boolean {
        val normalized = value?.trim()?.lowercase(Locale.ROOT)
            ?.replace(Regex("\\s+"), " ") ?: return true
        return riskyLabels.any { risky ->
            normalized == risky ||
                normalized.startsWith("$risky ") ||
                normalized.endsWith(" $risky") ||
                normalized.contains(" $risky ")
        }
    }
}
