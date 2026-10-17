package com.mosharrof.agent.planner

import java.text.Normalizer

data class InstalledApp(val label: String, val packageName: String)

sealed interface TaskPlan {
    data class OpenApp(val app: InstalledApp) : TaskPlan
    data class TapVisibleText(val text: String, val app: InstalledApp) : TaskPlan
    data class TypeText(val text: String, val app: InstalledApp) : TaskPlan
    data class SwipeScreen(val direction: AgentAction.Direction, val app: InstalledApp) : TaskPlan
    data class GlobalNavigation(val destination: AgentAction.NavigationDestination) : TaskPlan
    data object OpenSystemSettings : TaskPlan
    data class OpenSettingPanel(val setting: AgentAction.SupportedSetting) : TaskPlan
    data class SystemIntent(val kind: DeviceIntentRequest.Kind, val target: String = "", val text: String = "", val seconds: Int = 0) : TaskPlan
    data class NeedsChoice(val candidates: List<InstalledApp>) : TaskPlan
    data class Rejected(val reason: String) : TaskPlan
}

/** Resolves explicit commands only; unsupported or high-risk actions fail closed. */
class TaskPlanner(private val parser: IntentParser = IntentParser()) {
    fun plan(command: String, installedApps: List<InstalledApp>): TaskPlan {
        DeviceIntentRequest.parse(command)?.let { return TaskPlan.SystemIntent(it.kind, it.target, it.text, it.seconds) }
        when (val explicit = CommandParser().parse(command)) {
            is ParsedCommand.GlobalNavigation -> return TaskPlan.GlobalNavigation(explicit.destination)
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
            is ParsedIntent.TypeText -> {
                val targetApp = intent.appQuery?.takeIf { it.isNotBlank() }
                    ?: return TaskPlan.Rejected("লেখাটি কোন অ্যাপে প্রবেশ করাতে হবে তা নির্দিষ্ট করুন।")
                when (val appPlan = resolveApp(targetApp, installedApps)) {
                    is TaskPlan.OpenApp -> TaskPlan.TypeText(intent.text, appPlan.app)
                    is TaskPlan.NeedsChoice -> appPlan
                    is TaskPlan.Rejected -> appPlan
                    else -> TaskPlan.Rejected("এই অ্যাপে টেক্সট ইনপুট সমর্থিত নয়।")
                }
            }
            is ParsedIntent.OpenApp -> resolveApp(intent.query, installedApps)
            is ParsedIntent.Swipe -> {
                when (val appPlan = resolveApp(intent.appQuery, installedApps)) {
                    is TaskPlan.OpenApp -> TaskPlan.SwipeScreen(intent.direction, appPlan.app)
                    is TaskPlan.NeedsChoice -> appPlan
                    is TaskPlan.Rejected -> appPlan
                    else -> TaskPlan.Rejected("এই অ্যাপের স্ক্রল action সমর্থিত নয়।")
                }
            }
            is ParsedIntent.TapText -> {
                if (isHighRiskLabel(intent.text)) {
                    TaskPlan.Rejected("এই উচ্চ-ঝুঁকির বোতাম এখনো স্বয়ংক্রিয়ভাবে চাপা যাবে না; কোনো কাজ করা হয়নি।")
                } else {
                    when (val appPlan = resolveApp(intent.appQuery, installedApps)) {
                        is TaskPlan.OpenApp -> TaskPlan.TapVisibleText(intent.text, appPlan.app)
                        is TaskPlan.NeedsChoice -> appPlan
                        is TaskPlan.Rejected -> appPlan
                        else -> TaskPlan.Rejected("এই অ্যাপের UI action সমর্থিত নয়।")
                    }
                }
            }
        }
    }

    private fun resolveApp(queryText: String, installedApps: List<InstalledApp>): TaskPlan {
        val query = normalizeAppName(queryText)
        val matches = installedApps
            .filter { normalizeAppName(it.label) == query }
            .distinctBy { it.packageName }
        return when (matches.size) {
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

    private fun isHighRiskLabel(value: String): Boolean {
        val label = normalizeAliasKey(value)
        return HIGH_RISK_LABELS.any { label.contains(normalizeAliasKey(it)) }
    }

    private fun normalizeAppName(value: String): String {
        val normalized = normalizeAliasKey(value)
        return BENGALI_ALIASES.entries.firstOrNull {
            normalizeAliasKey(it.key) == normalized || normalizeAliasKey(it.key) == normalized.removeSuffix("ে")
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
        private val HIGH_RISK_LABELS = listOf(
            "send", "delete", "remove", "buy", "purchase", "pay", "share", "post",
            "submit", "allow", "deny", "confirm", "install", "uninstall",
            "পাঠান", "মুছুন", "ডিলিট", "কিনুন", "পেমেন্ট", "শেয়ার", "পোস্ট",
            "জমা দিন", "অনুমতি", "নিশ্চিত", "ইনস্টল", "আনইনস্টল"
        )
    }
}
