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

        parseTypeTextCommand(text)?.let { return it }
        parseTapCommand(text)?.let { return it }
        parseSwipeCommand(text)?.let { return it }

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
            ?: return ParsedIntent.Unsupported("এখন শুধু স্পষ্ট অ্যাপ-খোলার বা নির্দিষ্ট UI ট্যাপ কমান্ড সমর্থিত")
        val query = match.groupValues[1].trim().trim('"', '\'')
        if (query.isBlank()) return ParsedIntent.Unsupported("অ্যাপের নাম পাওয়া যায়নি")
        return ParsedIntent.OpenApp(query)
    }

    private fun parseTypeTextCommand(text: String): ParsedIntent.TypeText? {
        val english = Regex("""^(?:type|enter|write)\s+"(.{1,160}?)"\s+(?:in|into)\s+(.+)$""", RegexOption.IGNORE_CASE).find(text)
        if (english != null) {
            val value = english.groupValues[1].trim()
            val app = english.groupValues[2].trim()
            if (value.isNotBlank() && app.isNotBlank()) return ParsedIntent.TypeText(value, app)
        }
        val bengali = Regex("""^(.+?)(?:-এ| এ)\s+"(.{1,160}?)"\s+(?:লিখুন|লিখে দিন|টাইপ করুন)$""", RegexOption.IGNORE_CASE).find(text)
        if (bengali != null) {
            val app = bengali.groupValues[1].trim()
            val value = bengali.groupValues[2].trim()
            if (value.isNotBlank() && app.isNotBlank()) return ParsedIntent.TypeText(value, app)
        }
        return null
    }
    private fun parseSwipeCommand(text: String): ParsedIntent.Swipe? {
        val english = Regex("^(?:swipe|scroll)\\s+(up|down|left|right)\\s+(?:in|inside|on)\\s+(.+)$", RegexOption.IGNORE_CASE).find(text)
        if (english != null) {
            val direction = when (english.groupValues[1].lowercase()) {
                "up" -> AgentAction.Direction.UP
                "down" -> AgentAction.Direction.DOWN
                "left" -> AgentAction.Direction.LEFT
                else -> AgentAction.Direction.RIGHT
            }
            return ParsedIntent.Swipe(direction, english.groupValues[2].trim())
        }
        val bengali = Regex("^(.+?)\\s+(উপরে|নিচে|বামে|ডানে)\\s+স্ক্রল(?:\\s+(?:করুন|করো))?$", RegexOption.IGNORE_CASE).find(text)
            ?: return null
        val direction = when (bengali.groupValues[2]) {
            "উপরে" -> AgentAction.Direction.UP
            "নিচে" -> AgentAction.Direction.DOWN
            "বামে" -> AgentAction.Direction.LEFT
            else -> AgentAction.Direction.RIGHT
        }
        return ParsedIntent.Swipe(direction, bengali.groupValues[1].trim())
    }

    private fun parseTapCommand(text: String): ParsedIntent.TapText? {
        val english = Regex(
            "^(?:tap|click|ট্যাপ(?: করুন| করো)?)\\s+[\\\"]?(.+?)[\\\"]?\\s+(?:in|inside)\\s+(.+)$",
            RegexOption.IGNORE_CASE
        ).find(text)
        if (english != null) {
            val target = english.groupValues[1].trim().trim('"', '\'')
            val app = english.groupValues[2].trim().trim('"', '\'')
            if (target.isNotBlank() && app.isNotBlank()) return ParsedIntent.TapText(target, app)
        }

        val bengali = Regex(
            "^(.+?)(?:-এ| এ)\\s+(.+?)\\s+(?:ট্যাপ করুন|ট্যাপ করো|চাপ দিন|চাপুন)$",
            RegexOption.IGNORE_CASE
        ).find(text) ?: return null
            val app = bengali.groupValues[1].trim().trim('"', '\'')
        val target = bengali.groupValues[2].trim().trim('"', '\'')
        return if (app.isNotBlank() && target.isNotBlank()) ParsedIntent.TapText(target, app) else null
    }

    companion object {
        const val MAX_COMMAND_LENGTH = 240
    }
}

sealed interface ParsedIntent {
    data class OpenApp(val query: String) : ParsedIntent
    data class TapText(val text: String, val appQuery: String) : ParsedIntent
    data class TypeText(val text: String, val appQuery: String? = null) : ParsedIntent
    data class Swipe(val direction: AgentAction.Direction, val appQuery: String) : ParsedIntent
    data class Unsupported(val reason: String) : ParsedIntent
}
