package com.mosharrof.agent.planner

import java.util.Locale

/**
 * Deterministic first-stage parser for simple commands.
 * App names must be explicitly mapped to package IDs by the app owner.
 * Unknown commands are never guessed or executed.
 */
class TaskParser(private val appAliases: Map<String, String>) {
    fun parse(input: String): TaskParseResult {
        val text = normalize(input)
        if (text.isBlank()) {
            return TaskParseResult.NeedsClarification("কী কাজ করতে চান তা লিখুন বা বলুন।")
        }

        if (matches(text, listOf("স্ক্রিন দেখ", "স্ক্রিন পরীক্ষা", "inspect screen", "check screen"))) {
            return TaskParseResult.Proposed(AgentAction.InspectScreen, "বর্তমান স্ক্রিন পরীক্ষা")
        }

        val openPrefix = listOf("খোলো ", "চালু কর ", "open ", "launch ")
            .firstOrNull { text.startsWith(it) }
        if (openPrefix != null) {
            val requestedName = text.removePrefix(openPrefix).trim()
            val packageName = resolveApp(requestedName)
                ?: return TaskParseResult.NeedsClarification(
                    "“$requestedName” অ্যাপটি নির্দিষ্ট করে চিনতে পারিনি। অ্যাপের নাম নিশ্চিত করুন।"
                )
            return TaskParseResult.Proposed(
                AgentAction.OpenApp(packageName, userRequested = true),
                "অ্যাপ খুলুন: $requestedName"
            )
        }

        val direction = when {
            matches(text, listOf("উপরে স্ক্রল", "উপরে যাও", "scroll up", "swipe up")) -> AgentAction.Direction.UP
            matches(text, listOf("নিচে স্ক্রল", "নিচে যাও", "scroll down", "swipe down")) -> AgentAction.Direction.DOWN
            matches(text, listOf("বামে স্ক্রল", "বামে যাও", "scroll left", "swipe left")) -> AgentAction.Direction.LEFT
            matches(text, listOf("ডানে স্ক্রল", "ডানে যাও", "scroll right", "swipe right")) -> AgentAction.Direction.RIGHT
            else -> null
        }
        if (direction != null) {
            return TaskParseResult.NeedsClarification("কোন অ্যাপের মধ্যে স্ক্রল করতে চান তা বলুন।")
        }

        if (text.contains("পাঠাও") || text.contains("delete") ||
            text.contains("মুছে") || text.contains("কিনে") ||
            text.contains("send") || text.contains("purchase")
        ) {
            return TaskParseResult.NeedsClarification(
                "এই কাজের লক্ষ্য ও প্রভাব আগে নিশ্চিত করতে হবে; এখন কোনো পরিবর্তন করা হয়নি।"
            )
        }

        return TaskParseResult.Unsupported(
            "এই কমান্ডটি এখনো সমর্থিত নয়। কোনো অ্যাকশন চালানো হয়নি।"
        )
    }

    private fun resolveApp(name: String): String? =
        appAliases.entries.firstOrNull { normalize(it.key) == name }?.value

    private fun matches(text: String, phrases: List<String>): Boolean =
        phrases.any { text == normalize(it) }

    private fun normalize(value: String): String =
        value.trim().lowercase(Locale.ROOT).replace(Regex("\\s+"), " ")
}
