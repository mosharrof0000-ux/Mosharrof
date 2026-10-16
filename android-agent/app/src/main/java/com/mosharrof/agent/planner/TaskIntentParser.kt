package com.mosharrof.agent.planner

/**
 * Deterministic command parser. It never invents package names: app aliases are
 * supplied by the caller from an explicit, user-visible allowlist.
 */
class TaskIntentParser(
    private val appAliases: Map<String, String>
) {
    fun parse(input: String): ParseResult {
        val command = input.trim().lowercase()
        if (command.isBlank()) return ParseResult.NeedsClarification("কী কাজ করতে হবে বলুন।")

        val openPrefix = listOf("open ", "launch ", "খুলুন ", "খোলো ", "চালু কর ")
            .firstOrNull { command.startsWith(it) }
        if (openPrefix != null) {
            val requestedName = command.removePrefix(openPrefix).trim()
            val packageName = appAliases[requestedName]
                ?: return ParseResult.NeedsClarification(
                    "এই অ্যাপটি অনুমোদিত তালিকায় নেই: $requestedName"
                )
            return ParseResult.Ready(
                AgentAction.OpenApp(packageName = packageName, userRequested = true)
            )
        }

        if (command in listOf("inspect screen", "স্ক্রিন দেখুন", "স্ক্রিন পরীক্ষা করুন")) {
            return ParseResult.Ready(AgentAction.InspectScreen)
        }

        return ParseResult.NeedsClarification(
            "কমান্ডটি নিশ্চিতভাবে বোঝা যায়নি। নির্দিষ্ট অ্যাপের নামসহ আবার বলুন।"
        )
    }
}

sealed interface ParseResult {
    data class Ready(val action: AgentAction) : ParseResult
    data class NeedsClarification(val message: String) : ParseResult
}
