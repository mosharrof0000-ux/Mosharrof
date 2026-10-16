package com.mosharrof.agent.planner

/** A parser result is a proposal only; it never executes an action. */
sealed interface TaskParseResult {
    data class Proposed(val action: AgentAction, val summary: String) : TaskParseResult
    data class NeedsClarification(val question: String) : TaskParseResult
    data class Unsupported(val reason: String) : TaskParseResult
}
