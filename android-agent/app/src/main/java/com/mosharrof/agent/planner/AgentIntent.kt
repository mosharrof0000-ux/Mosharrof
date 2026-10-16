package com.mosharrof.agent.planner

/** Safe, typed outcomes from parsing user-provided text or speech. */
sealed interface AgentIntent {
    data class OpenApp(val appKey: String) : AgentIntent
    data object InspectCurrentScreen : AgentIntent
    data class SearchWeb(val query: String) : AgentIntent
    data class Unknown(val reason: String) : AgentIntent
}
