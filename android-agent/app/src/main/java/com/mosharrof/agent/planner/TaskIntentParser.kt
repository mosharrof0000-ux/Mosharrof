package com.mosharrof.agent.planner

enum class TaskIntent {
    OPEN_SETTINGS,
    OPEN_ACCESSIBILITY_SETTINGS,
    INSPECT_CURRENT_SCREEN,
    UNSUPPORTED
}

data class ParsedTask(
    val intent: TaskIntent,
    val normalizedCommand: String,
    val requiresConfirmation: Boolean,
    val explanation: String
)

/** Small deterministic first-stage parser; unknown requests never become executable actions. */
class TaskIntentParser {
    fun parse(command: String): ParsedTask {
        val normalized = command.trim().lowercase()
            .replace(Regex("\\s+"), " ")

        if (normalized.isBlank()) {
            return ParsedTask(
                TaskIntent.UNSUPPORTED, normalized, true,
                "আগে একটি কাজ লিখুন বা বলুন।"
            )
        }

        if (matches(normalized, "accessibility settings", "অ্যাক্সেসিবিলিটি সেটিংস",
                "অ্যাক্সেসিবিলিটি অনুমতি সেটিংস", "accessibility permission settings")) {
            return ParsedTask(
                TaskIntent.OPEN_ACCESSIBILITY_SETTINGS, normalized, false,
                "Android-এর Accessibility Settings খুলবে। অনুমতি আপনি নিজে চালু করবেন।"
            )
        }

        if (matches(normalized, "open settings", "settings kholo", "সেটিংস খোলো",
                "সেটিংস খুলুন", "সেটিংস চালু করো", "সেটিংস চালু করুন")) {
            return ParsedTask(
                TaskIntent.OPEN_SETTINGS, normalized, false,
                "Android Settings খুলবে; কোনো সেটিং নিজে থেকে পরিবর্তন হবে না।"
            )
        }

        if (matches(normalized, "scan current screen", "inspect current screen",
                "বর্তমান স্ক্রিন স্ক্যান করো", "বর্তমান স্ক্রিন দেখো",
                "স্ক্রিন পরীক্ষা করো", "বর্তমান স্ক্রিন পরীক্ষা করো")) {
            return ParsedTask(
                TaskIntent.INSPECT_CURRENT_SCREEN, normalized, true,
                "শুধু Accessibility চালু থাকলে দৃশ্যমান UI-এর সীমিত কাঠামো পরীক্ষা করা যাবে।"
            )
        }

        return ParsedTask(
            TaskIntent.UNSUPPORTED, normalized, true,
            "এই নির্দেশ এখনো সমর্থিত নয়। নিরাপত্তার জন্য অনুমান করে কাজ চালানো হবে না।"
        )
    }

    private fun matches(value: String, vararg phrases: String): Boolean =
        phrases.any { value == it.lowercase() }
}
