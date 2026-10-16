package com.mosharrof.agent.planner

import java.text.Normalizer

data class InstalledApp(val label: String, val packageName: String)

sealed interface TaskPlan {
    data class OpenApp(val app: InstalledApp) : TaskPlan
    data object OpenSystemSettings : TaskPlan
    data class OpenSettingPanel(val setting: AgentAction.SupportedSetting) : TaskPlan
    data class NeedsChoice(val candidates: List<InstalledApp>) : TaskPlan
    data class Rejected(val reason: String) : TaskPlan
}

/** Resolves explicit app and Settings commands; unsupported actions fail closed. */
class TaskPlanner(private val parser: IntentParser = IntentParser()) {
    fun plan(command: String, installedApps: List<InstalledApp>): TaskPlan {
        when (val explicit = CommandParser().parse(command)) {
            ParsedCommand.OpenSystemSettings -> return TaskPlan.OpenSystemSettings
            is ParsedCommand.OpenSettingPanel -> return TaskPlan.OpenSettingPanel(explicit.setting)
            is ParsedCommand.OpenApp -> {
                val app = installedApps.singleOrNull { it.packageName == explicit.packageName }
                return if (app == null) TaskPlan.Rejected("এই package-এর launchable অ্যাপ পাওয়া যায়নি")
                else TaskPlan.OpenApp(app)
            }
            ParsedCommand.Unknown -> Unit
        }

        return when (val intent = parser.parse(command)) {
            is ParsedIntent.Unsupported -> TaskPlan.Rejected(intent.reason)
            is ParsedIntent.OpenApp -> {
                val query = normalizeAppName(intent.query)
                val matches = installedApps
                    .filter { normalizeAppName(it.label) == query }
                    .distinctBy { it.packageName }
                when (matches.size) {
                    1 -> TaskPlan.OpenApp(matches.single())
                    0 -> {
                        val partial = installedApps.filter {
                            normalizeAppName(it.label).contains(query) ||
                                query.contains(normalizeAppName(it.label))
                        }.distinctBy { it.packageName }.take(MAX_CHOICES)
                        if (partial.isEmpty()) TaskPlan.Rejected("ইনস্টল করা অ্যাপে এই নাম পাওয়া যায়নি")
                        else TaskPlan.NeedsChoice(partial)
                    }
                    else -> TaskPlan.NeedsChoice(matches.take(MAX_CHOICES))
                }
            }
        }
    }

    private fun normalizeAppName(value: String): String {
        val normalized = normalizeAliasKey(value)
        return BENGALI_ALIASES.entries.firstOrNull {
            normalizeAliasKey(it.key) == normalized
        }?.value ?: normalized
    }

    private fun normalizeAliasKey(value: String): String =
        Normalizer.normalize(value, Normalizer.Form.NFC)
            .replace(Regex("[\\u200B-\\u200D\\uFEFF]"), "")
            .trim().lowercase().replace(Regex("[^\\p{L}\\p{M}\\p{N}]"), "")

    companion object {
        const val MAX_CHOICES = 5
        private val BENGALI_ALIASES = mapOf(
            "ইউটিউব" to "youtube",
            "হোয়াটসঅ্যাপ" to "whatsapp",
            "হোয়াটসঅ্যাপ" to "whatsapp",
            "ফেসবুক" to "facebook",
            "মেসেঞ্জার" to "messenger",
            "ক্রোম" to "chrome",
            "ক্যামেরা" to "camera",
            "গ্যালারি" to "gallery",
            "সেটিংস" to "settings",
            "টেলিগ্রাম" to "telegram",
            "জিমেইল" to "gmail",
            "ইনস্টাগ্রাম" to "instagram"
        )
    }
}
