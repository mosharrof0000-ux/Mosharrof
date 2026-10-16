package com.mosharrof.agent.planner

data class InstalledApp(val label: String, val packageName: String)

sealed interface TaskPlan {
    data class OpenApp(val app: InstalledApp) : TaskPlan
    data class NeedsChoice(val candidates: List<InstalledApp>) : TaskPlan
    data class Rejected(val reason: String) : TaskPlan
}

/** Resolves an explicit app name only; it does not execute the resulting action. */
class TaskPlanner(private val parser: IntentParser = IntentParser()) {
    fun plan(command: String, installedApps: List<InstalledApp>): TaskPlan {
        return when (val intent = parser.parse(command)) {
            is ParsedIntent.Unsupported -> TaskPlan.Rejected(intent.reason)
            is ParsedIntent.OpenApp -> {
                val query = normalize(intent.query)
                val matches = installedApps
                    .filter { normalize(it.label) == query }
                    .distinctBy { it.packageName }
                when (matches.size) {
                    1 -> TaskPlan.OpenApp(matches.single())
                    0 -> {
                        val partial = installedApps.filter {
                            normalize(it.label).contains(query) ||
                                query.contains(normalize(it.label))
                        }.distinctBy { it.packageName }.take(MAX_CHOICES)
                        if (partial.isEmpty()) TaskPlan.Rejected("ইনস্টল করা অ্যাপে এই নাম পাওয়া যায়নি")
                        else TaskPlan.NeedsChoice(partial)
                    }
                    else -> TaskPlan.NeedsChoice(matches.take(MAX_CHOICES))
                }
            }
        }
    }

    private fun normalize(value: String): String =
        value.trim().lowercase().replace(Regex("[^\\p{L}\\p{N}]"), "")

    companion object {
        const val MAX_CHOICES = 5
    }
}
