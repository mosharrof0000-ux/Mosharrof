package com.mosharrof.agent.execution

/**
 * A bounded, deterministic coordinator for user-approved Android actions.
 *
 * Platform adapters must implement [StepDriver] using narrow Android APIs. This
 * class never accepts shell commands, arbitrary code, or model-generated intents.
 */
data class PlannedActionStep(
    val id: String,
    val description: String,
    val risk: Risk,
    val expectedPostcondition: String
) {
    enum class Risk { LOW, MODERATE, HIGH }
}

data class StepOutcome(
    val success: Boolean,
    val message: String
)

data class StepReport(
    val stepId: String,
    val status: Status,
    val message: String
) {
    enum class Status { SUCCEEDED, REJECTED, FAILED, RECOVERED, CANCELLED }
}

data class TaskExecutionReport(
    val status: Status,
    val steps: List<StepReport>
) {
    enum class Status { SUCCEEDED, CANCELLED, FAILED, INVALID_PLAN }
}

/** Adapter contract: execute one step, verify its result, or perform one safe recovery. */
interface StepDriver {
    fun execute(step: PlannedActionStep): StepOutcome
    fun verify(step: PlannedActionStep): Boolean
    fun recover(step: PlannedActionStep): Boolean
}

class TaskExecutionEngine(
    private val driver: StepDriver,
    private val maxSteps: Int = DEFAULT_MAX_STEPS
) {
    init {
        require(maxSteps in 1..DEFAULT_MAX_STEPS) { "maxSteps must be between 1 and $DEFAULT_MAX_STEPS" }
    }

    fun execute(
        plan: List<PlannedActionStep>,
        isCancelled: () -> Boolean,
        confirm: (PlannedActionStep) -> Boolean
    ): TaskExecutionReport {
        if (plan.isEmpty() || plan.size > maxSteps ||
            plan.any { it.id.isBlank() || it.description.isBlank() || it.expectedPostcondition.isBlank() } ||
            plan.map { it.id }.distinct().size != plan.size
        ) {
            return TaskExecutionReport(TaskExecutionReport.Status.INVALID_PLAN, emptyList())
        }

        val reports = mutableListOf<StepReport>()
        for (step in plan) {
            if (isCancelled()) {
                reports += StepReport(step.id, StepReport.Status.CANCELLED, "ব্যবহারকারীর নির্দেশে কাজ থামানো হয়েছে।")
                return TaskExecutionReport(TaskExecutionReport.Status.CANCELLED, reports)
            }

            if (step.risk != PlannedActionStep.Risk.LOW && !confirm(step)) {
                reports += StepReport(step.id, StepReport.Status.REJECTED, "অনুমতি দেওয়া হয়নি; এই ধাপ চালানো হয়নি।")
                return TaskExecutionReport(TaskExecutionReport.Status.CANCELLED, reports)
            }

            val outcome = runCatching { driver.execute(step) }
                .getOrElse { StepOutcome(false, "ধাপ চালাতে ত্রুটি হয়েছে: ${it.message ?: "অজানা ত্রুটি"}") }
            if (!outcome.success) {
                val recovered = runCatching { driver.recover(step) }.getOrDefault(false)
                reports += StepReport(
                    step.id,
                    if (recovered) StepReport.Status.RECOVERED else StepReport.Status.FAILED,
                    outcome.message
                )
                return TaskExecutionReport(
                    if (recovered) TaskExecutionReport.Status.CANCELLED else TaskExecutionReport.Status.FAILED,
                    reports
                )
            }

            val verified = runCatching { driver.verify(step) }.getOrDefault(false)
            if (!verified) {
                val recovered = runCatching { driver.recover(step) }.getOrDefault(false)
                reports += StepReport(
                    step.id,
                    if (recovered) StepReport.Status.RECOVERED else StepReport.Status.FAILED,
                    "কাজের ফল যাচাই করা যায়নি; ${if (recovered) "নিরাপদ পুনরুদ্ধার করা হয়েছে" else "আরও কাজ বন্ধ রাখা হয়েছে"}।"
                )
                return TaskExecutionReport(
                    if (recovered) TaskExecutionReport.Status.CANCELLED else TaskExecutionReport.Status.FAILED,
                    reports
                )
            }

            reports += StepReport(step.id, StepReport.Status.SUCCEEDED, "সম্পন্ন ও যাচাইকৃত: ${step.expectedPostcondition}")
        }
        return TaskExecutionReport(TaskExecutionReport.Status.SUCCEEDED, reports)
    }

    companion object {
        const val DEFAULT_MAX_STEPS = 12
    }
}
