package com.mosharrof.agent.planner

/**
 * Parses only explicit, bounded commands. It never guesses an action from arbitrary text.
 * Keep this parser deterministic so its behavior can be unit-tested without Android.
 */
class IntentParser {
    fun parse(rawText: String): ParsedIntent {
        val text = rawText.trim().replace(Regex("\\s+"), " ")
        if (text.isBlank() || text.length > MAX_COMMAND_LENGTH) {
            return ParsedIntent.Unsupported("কমান্ড খালি অথবা অতিরিক্ত বড়")
        }

        val suffix = listOf("খুলে দাও", "খুলুন", "খোলো", "চালু করো", "চালু করুন")
            .firstOrNull { text.endsWith(" $it", ignoreCase = true) }
        if (suffix != null) {
            val query = text.removeSuffix(" $suffix").trim()
            if (query.isBlank()) return ParsedIntent.Unsupported("অ্যাপের নাম পাওয়া যায়নি")
            return ParsedIntent.OpenApp(query)
        }
        val patterns = listOf(
            Regex("^(?:open|launch|start|চালু কর(?:ো|ুন)?|খুল(?:ো|ুন)?)\\s+(.+)$", RegexOption.IGNORE_CASE),
            Regex("^(.+?)\\s+(?:খুলে দাও|খুলুন|চালু করো|চালু করুন)$", RegexOption.IGNORE_CASE)
        )
        val match = patterns.firstNotNullOfOrNull { it.find(text) }
            ?: return ParsedIntent.Unsupported("এখন শুধু স্পষ্ট অ্যাপ-খোলার কমান্ড সমর্থিত")
        val query = match.groupValues[1].trim().trim('"', '\'')
        if (query.isBlank()) return ParsedIntent.Unsupported("অ্যাপের নাম পাওয়া যায়নি")
        return ParsedIntent.OpenApp(query)
    }

    companion object {
        const val MAX_COMMAND_LENGTH = 240
    }
}

sealed interface ParsedIntent {
    data class OpenApp(val query: String) : ParsedIntent
    data class Unsupported(val reason: String) : ParsedIntent
}
