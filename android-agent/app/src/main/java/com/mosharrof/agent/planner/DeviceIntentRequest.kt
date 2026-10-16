package com.mosharrof.agent.planner

/** Structured, bounded requests handed to Android-owned dialer, SMS, timer, or calendar UI. */
data class DeviceIntentRequest(
    val kind: Kind,
    val target: String = "",
    val text: String = "",
    val seconds: Int = 0
) {
    enum class Kind { DIAL, COMPOSE_SMS, SET_TIMER, CREATE_CALENDAR_EVENT }

    companion object {
        private val phone = Regex("\\+?[0-9][0-9 ()-]{5,19}")

        fun parse(raw: String): DeviceIntentRequest? {
            val command = raw.trim()
            if (command.length !in 1..240) return null
            val dial = Regex("(?i)^(?:call|dial|কল করুন|ফোন করুন)\\s+(.+)$").matchEntire(command)
            if (dial != null) {
                val number = dial.groupValues[1].trim()
                if (!phone.matches(number)) return null
                return DeviceIntentRequest(Kind.DIAL, target = number)
            }
            val sms = Regex("(?i)^(?:sms|text|মেসেজ লিখুন)\\s+([^ ]+)\\s+(.+)$").matchEntire(command)
            if (sms != null) {
                val number = sms.groupValues[1].trim()
                val message = sms.groupValues[2].trim()
                if (!phone.matches(number) || message.isBlank() || message.length > 500) return null
                return DeviceIntentRequest(Kind.COMPOSE_SMS, target = number, text = message)
            }
            val timer = Regex("(?i)^(?:timer|set timer|টাইমার)\\s+(\\d{1,3})\\s*(seconds?|secs?|minutes?|mins?|hours?|ঘণ্টা|মিনিট|সেকেন্ড)?$").matchEntire(command)
            if (timer != null) {
                val amount = timer.groupValues[1].toIntOrNull() ?: return null
                val unit = timer.groupValues[2].lowercase()
                val seconds = when (unit) {
                    "hour", "hours", "ঘণ্টা" -> amount * 3600
                    "second", "seconds", "sec", "secs", "সেকেন্ড" -> amount
                    else -> amount * 60
                }
                if (seconds !in 1..86400) return null
                return DeviceIntentRequest(Kind.SET_TIMER, seconds = seconds)
            }
            val event = Regex("(?i)^(?:calendar|event|ক্যালেন্ডারে যোগ করুন)\\s+(.+)$").matchEntire(command)
            if (event != null) {
                val title = event.groupValues[1].trim()
                if (title.isBlank() || title.length > 120) return null
                return DeviceIntentRequest(Kind.CREATE_CALENDAR_EVENT, text = title)
            }
            return null
        }
    }
}
