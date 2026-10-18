package com.mosharrof.agent.planner

import java.time.LocalDate
import java.time.format.DateTimeFormatter

/** Parses a deliberately small set of clock/calendar requests into Android-owned intents. */
sealed interface DeviceIntentCommand {
    data class SetTimer(val seconds: Int) : DeviceIntentCommand
    data class SetAlarm(val hour: Int, val minute: Int) : DeviceIntentCommand
    data class CreateCalendarEvent(val title: String, val dayOffset: Int, val hour: Int, val minute: Int, val dateIso: String? = null) : DeviceIntentCommand
    data object OpenCalendar : DeviceIntentCommand
}

object DeviceIntentCommandParser {
    fun parse(raw: String): DeviceIntentCommand? {
        val command = normalizeDigits(raw.trim().lowercase())
        if (command.isBlank() || command.length > 240) return null
        if (command.contains("timer") || command.contains("টাইমার")) {
            val match = TIMER.find(command) ?: TIMER_SUFFIX.find(command) ?: return null
            val amount = match.groupValues[1].toIntOrNull() ?: return null
            val unit = match.groupValues[2]
            val multiplier = when {
                unit.startsWith("hour") || unit.startsWith("ঘণ্টা") || unit.startsWith("ঘন্টা") -> 3600
                unit.startsWith("sec") || unit.startsWith("সেকেন্ড") -> 1
                else -> 60
            }
            val seconds = amount * multiplier
            return if (seconds in 1..86400) DeviceIntentCommand.SetTimer(seconds) else null
        }
        if (command.contains("alarm") || command.contains("অ্যালার্ম")) {
            val match = TIME.find(command) ?: return null
            val hour = match.groupValues[1].toIntOrNull() ?: return null
            val minute = match.groupValues[2].toIntOrNull() ?: return null
            if (hour !in 0..23 || minute !in 0..59) return null
            return DeviceIntentCommand.SetAlarm(hour, minute)
        }
        if (command.contains("calendar") || command.contains("ক্যালেন্ডার")) {
            if (command.contains("open calendar") || command == "ক্যালেন্ডার খুলুন") return DeviceIntentCommand.OpenCalendar
            val time = TIME.find(command) ?: return null
            val hour = time.groupValues[1].toIntOrNull() ?: return null
            val minute = time.groupValues[2].toIntOrNull() ?: return null
            if (hour !in 0..23 || minute !in 0..59) return null
            val dateMatch = DATE.find(command)
            val dateIso = dateMatch?.let { match ->
                runCatching {
                    val rawDate = match.value
                    when {
                        rawDate.contains("-") && rawDate.length == 10 && rawDate.take(4).all(Char::isDigit) ->
                            LocalDate.parse(rawDate, DateTimeFormatter.ISO_LOCAL_DATE).toString()
                        rawDate.contains("/") -> {
                            val parts = rawDate.split("/")
                            if (parts.size != 3) return null
                            val (day, month, year) = parts.map { it.toInt() }
                            LocalDate.of(year, month, day).toString()
                        }
                        rawDate.count { it == '-' } == 2 -> {
                            val parts = rawDate.split("-")
                            val (day, month, year) = parts.map { it.toInt() }
                            LocalDate.of(year, month, day).toString()
                        }
                        else -> null
                    }
                }.getOrNull()
            }
            if (dateMatch != null && dateIso == null) return null
            val dayOffset = if (dateIso == null && (command.contains("tomorrow") || command.contains("আগামীকাল") || command.contains("কাল"))) 1 else 0
            val title = EVENT_TITLE.find(command)?.groupValues?.get(1)?.trim().orEmpty()
                .ifBlank { "MOSHARROF-এর নির্ধারিত ইভেন্ট" }.take(100)
            return DeviceIntentCommand.CreateCalendarEvent(title, dayOffset, hour, minute, dateIso)
        }
        return null
    }

    private fun normalizeDigits(value: String): String {
        val bangla = "০১২৩৪৫৬৭৮৯"
        return value.map { ch -> val index = bangla.indexOf(ch); if (index >= 0) ('0'.code + index).toChar() else ch }.joinToString("")
    }

    private val TIMER = Regex("(?:timer|টাইমার)\\s*(?:for|এর জন্য)?\\s*(\\d+)\\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?|ঘণ্টা|ঘন্টা|মিনিট|সেকেন্ড)")
    private val TIMER_SUFFIX = Regex("(\\d+)\\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?|ঘণ্টা|ঘন্টা|মিনিট(?:ের)?|সেকেন্ড)\\s*(?:এর\\s*)?(?:timer|টাইমার)")
    private val TIME = Regex("(?:at|for|আমার|সময়|সময়)?\\s*(\\d{1,2})[:.](\\d{2})")
    private val DATE = Regex("\\b(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4})\\b")
    private val EVENT_TITLE = Regex("(?:event|ইভেন্ট)\\s+(.+?)(?:\\s+(?:tomorrow|today|আগামীকাল|আজ|কাল)|\\s+\\d{4}-\\d{2}-\\d{2}|\\s+\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4}|\\s+\\d{1,2}[:.]\\d{2}|$)")
}
