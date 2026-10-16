package com.mosharrof.agent.policy

import com.mosharrof.agent.planner.AgentAction

enum class RiskLevel { LOW, MODERATE, HIGH }
enum class PolicyDecision { ALLOW, REQUIRE_CONFIRMATION, DENY }

data class PolicyResult(
    val decision: PolicyDecision,
    val risk: RiskLevel,
    val reason: String
)

/** Deterministic policy gate. Unknown or ambiguous actions fail closed. */
class ActionPolicy(
    private val allowedPackages: Set<String>,
    private val maxActionsPerTask: Int = 12
) {
    fun evaluate(action: AgentAction, actionsAlreadyRun: Int): PolicyResult {
        if (actionsAlreadyRun < 0 || actionsAlreadyRun >= maxActionsPerTask) {
            return PolicyResult(PolicyDecision.DENY, RiskLevel.HIGH, "Task action budget exceeded")
        }

        return when (action) {
            is AgentAction.OpenApp -> {
                if (!action.userRequested) {
                    PolicyResult(PolicyDecision.REQUIRE_CONFIRMATION, RiskLevel.MODERATE, "Opening an app was not explicitly requested")
                } else if (action.packageName !in allowedPackages) {
                    PolicyResult(PolicyDecision.DENY, RiskLevel.HIGH, "Target app is not allowlisted")
                } else {
                    PolicyResult(PolicyDecision.ALLOW, RiskLevel.LOW, "Explicit app launch is allowlisted")
                }
            }
            is AgentAction.TapSemanticNode -> {
                if (action.targetPackage !in allowedPackages) {
                    PolicyResult(PolicyDecision.DENY, RiskLevel.HIGH, "Target app is not allowlisted")
                } else if (action.resourceId.isNullOrBlank() &&
                    action.visibleText.isNullOrBlank() &&
                    action.contentDescription.isNullOrBlank()
                ) {
                    PolicyResult(PolicyDecision.DENY, RiskLevel.HIGH, "Semantic target is ambiguous")
                } else {
                    PolicyResult(PolicyDecision.REQUIRE_CONFIRMATION, RiskLevel.MODERATE, "UI interaction requires task-level approval")
                }
            }
            is AgentAction.Swipe -> {
                if (action.targetPackage !in allowedPackages) {
                    PolicyResult(PolicyDecision.DENY, RiskLevel.HIGH, "Target app is not allowlisted")
                } else {
                    PolicyResult(PolicyDecision.REQUIRE_CONFIRMATION, RiskLevel.MODERATE, "Gesture requires task-level approval")
                }
            }
            AgentAction.InspectScreen ->
                PolicyResult(PolicyDecision.ALLOW, RiskLevel.LOW, "Read-only screen inspection requested")
            is AgentAction.ToggleSystemSetting ->
                PolicyResult(PolicyDecision.REQUIRE_CONFIRMATION, RiskLevel.HIGH, "System setting changes require explicit confirmation")
            is AgentAction.InspectUserSelectedFile ->
                PolicyResult(PolicyDecision.REQUIRE_CONFIRMATION, RiskLevel.MODERATE, "File access requires a user-selected URI and confirmation")
        }
    }
}
