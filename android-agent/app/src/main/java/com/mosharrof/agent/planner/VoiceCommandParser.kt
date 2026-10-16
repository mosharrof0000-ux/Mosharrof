package com.mosharrof.agent.planner

/** Converts text to an intent only; it never performs device actions. */
class VoiceCommandParser {
    fun parse(input: String): AgentIntent {
        val command = input.trim().lowercase()
        if (command.isBlank()) return AgentIntent.Unknown("empty_command")

        appCommands.forEach { (key, phrases) ->
            if (phrases.any(command::contains)) return AgentIntent.OpenApp(key)
        }

        if (screenPhrases.any(command::contains)) {
            return AgentIntent.InspectCurrentScreen
        }

        val searchPrefix = searchPhrases.firstOrNull(command::startsWith)
        if (searchPrefix != null) {
            val query = command.removePrefix(searchPrefix).trim()
            return if (query.isBlank()) AgentIntent.Unknown("missing_search_query")
            else AgentIntent.SearchWeb(query)
        }
        return AgentIntent.Unknown("unrecognized_command")
    }

    private companion object {
        val appCommands = linkedMapOf(
            "phone" to listOf("open phone", "ফোন খোলো", "ফোন চালু করো"),
            "settings" to listOf("open settings", "সেটিংস খোলো", "সেটিংস খুলে দাও"),
            "camera" to listOf("open camera", "ক্যামেরা খোলো", "ক্যামেরা চালু করো"),
            "browser" to listOf("open browser", "ব্রাউজার খোলো", "ইন্টারনেট খোলো")
        )
        val screenPhrases = listOf(
            "inspect screen", "read screen", "স্ক্রিন দেখো", "পর্দা পড়ে শোনাও"
        )
        val searchPhrases = listOf(
            "search for ", "search ", "খুঁজে দেখো ", "অনুসন্ধান করো "
        )
    }
}
