package com.mosharrof.agent.planner

import java.text.Normalizer

/** Explicit Bengali/English app commands resolved only through a supplied alias map. */
class BengaliIntentParser(private val appAliases: Map<String, String>) {
    fun parse(rawCommand: String): BengaliParsedIntent {
        val command = normalize(rawCommand)
        if (command.isBlank()) return BengaliParsedIntent.NeedsClarification("কমান্ডটি শুনতে বা পড়তে পারিনি।")
        if (containsAny(command, listOf("স্ক্রিন দেখ", "স্ক্রিন পরীক্ষা", "বর্তমান স্ক্রিন", "inspect screen", "check screen"))) {
            return BengaliParsedIntent.InspectCurrentScreen
        }
        if (containsAny(command, listOf("অ্যাক্সেসিবিলিটি সেটিং", "accessibility settings", "অনুমতি সেটিং"))) {
            return BengaliParsedIntent.OpenAccessibilitySettings
        }

        val prefixes = listOf("open ", "launch ", "খুলে দাও ", "খুলুন ", "খোলো ", "চালু কর ", "চালু করুন ", "ওপেন ")
        val suffixes = listOf(" খুলে দাও", " খুলুন", " খোলো", " চালু করো", " চালু করুন")
        val name = prefixes.firstOrNull(command::startsWith)?.let(command::removePrefix)
            ?: suffixes.firstOrNull(command::endsWith)?.let(command::removeSuffix)
            ?: return BengaliParsedIntent.NeedsClarification("কমান্ডটি সমর্থিত নয়; স্পষ্ট করে বলুন।")
        val query = name.trim()
        if (query.isBlank()) return BengaliParsedIntent.NeedsClarification("কোন অ্যাপ খুলতে হবে বলুন।")
        val normalizedQuery = normalize(query)
        val packageName = appAliases.entries.firstOrNull { normalize(it.key) == normalizedQuery }?.value
        return if (packageName.isNullOrBlank()) {
            BengaliParsedIntent.NeedsClarification("অ্যাপটি অনুমোদিত তালিকায় নেই; খোলা হয়নি।")
        } else BengaliParsedIntent.OpenApp(packageName)
    }

    private fun containsAny(value: String, phrases: List<String>) =
        phrases.any { value.contains(normalize(it)) }

    private fun normalize(value: String): String =
        Normalizer.normalize(value, Normalizer.Form.NFC)
            .replace(Regex("[\\u200B-\\u200D\\uFEFF]"), "")
            .trim().lowercase().replace(Regex("\\s+"), " ")
}

sealed interface BengaliParsedIntent {
    data class OpenApp(val packageName: String) : BengaliParsedIntent
    data object OpenAccessibilitySettings : BengaliParsedIntent
    data object InspectCurrentScreen : BengaliParsedIntent
    data class NeedsClarification(val message: String) : BengaliParsedIntent
}
