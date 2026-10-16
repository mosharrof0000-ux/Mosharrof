package com.mosharrof.agent.planner

/**
 * Converts a small, explicit command vocabulary into typed actions.
 * Unsupported or ambiguous requests return a clarification instead of guessing.
 */
class IntentPlanner(
    private val knownApps: Map<String, String>
) {
    fun plan(rawCommand: String): PlanResult {
        val command = normalize(rawCommand)
        if (command.isBlank()) return PlanResult.NeedsClarification("কী কাজ করতে হবে লিখুন বা বলুন।")

        val openPrefix = listOf("open ", "launch ", "চালু কর", "খোলো", "ওপেন ")
            .firstOrNull { command.startsWith(it) }
            ?: return PlanResult.NeedsClarification(
                "এই কাজটি এখনো সমর্থিত নয়। আপাতত ‘open app name’ বা ‘সেটিংস খোলো’ বলুন।"
            )

        val appQuery = command.removePrefix(openPrefix).trim()
        if (appQuery.isBlank()) {
            return PlanResult.NeedsClarification("কোন অ্যাপটি খুলব, তার নাম বলুন।")
        }

        if (appQuery in listOf("settings", "setting", "সেটিংস", "সেটিং")) {
            return PlanResult.OpenSystemSettings
        }

        val packageName = knownApps[appQuery]
            ?: return PlanResult.NeedsClarification(
                "‘$appQuery’ অ্যাপটি অনুমোদিত তালিকায় নেই। অ্যাপের নাম নিশ্চিত করুন।"
            )
        return PlanResult.Action(
            AgentAction.OpenApp(packageName = packageName, userRequested = true)
        )
    }

    private fun normalize(value: String): String =
        value.trim().lowercase().replace(Regex("\\s+"), " ")

    sealed interface PlanResult {
        data class Action(val action: AgentAction) : PlanResult
        data object OpenSystemSettings : PlanResult
        data class NeedsClarification(val message: String) : PlanResult
    }
}
