package com.mosharrof.agent.planner

/**
 * Small deterministic parser for explicit commands. It never invents a target app:
 * app names must match a caller-supplied alias map.
 */
class BengaliIntentParser(
    private val appAliases: Map<String, String>
) {
    fun parse(rawCommand: String): ParsedIntent {
        val command = normalize(rawCommand)
        if (command.isBlank()) return ParsedIntent.NeedsClarification("কমান্ডটি শুনতে বা পড়তে পারিনি।")

        if (containsAny(command, listOf("স্ক্রিন দেখ", "স্ক্রিন পরীক্ষা", "বর্তমান স্ক্রিন", "inspect screen", "check screen"))) {
            return ParsedIntent.InspectCurrentScreen
        }
        if (containsAny(command, listOf("অ্যাক্সেসিবিলিটি সেটিং", "accessibility settings", "অনুমতি সেটিং"))) {
            return ParsedIntent.OpenAccessibilitySettings
        }

        val launchPrefix = listOf("খুলে দাও", "খুলুন", "খোলো", "চালু কর", "open ", "launch ")
            .firstOrNull { command.startsWith(it) }
            ?: return ParsedIntent.NeedsClarification("কমান্ডটি সমর্থিত নয়; কোন কাজটি করতে হবে স্পষ্ট করে বলুন।")

        val requestedName = command.removePrefix(launchPrefix).trim()
        if (requestedName.isBlank()) {
            return ParsedIntent.NeedsClarification("কোন অ্যাপ খুলতে হবে তার নাম বলুন।")
        }

        val packageName = appAliases.entries.firstOrNull { (alias, _) ->
            normalize(alias) == requestedName
        }?.value

        return if (packageName.isNullOrBlank()) {
            ParsedIntent.NeedsClarification("এই অ্যাপের নাম অনুমোদিত তালিকায় নেই। অ্যাপটি খুলিনি।")
        } else {
            ParsedIntent.OpenApp(packageName)
        }
    }

    private fun containsAny(value: String, phrases: List<String>): Boolean =
        phrases.any { value.contains(normalize(it)) }

    private fun normalize(value: String): String =
        value.trim().lowercase().replace(Regex("\\s+"), " ")
}

sealed interface ParsedIntent {
    data class OpenApp(val packageName: String) : ParsedIntent
    data object OpenAccessibilitySettings : ParsedIntent
    data object InspectCurrentScreen : ParsedIntent
    data class NeedsClarification(val message: String) : ParsedIntent
}
