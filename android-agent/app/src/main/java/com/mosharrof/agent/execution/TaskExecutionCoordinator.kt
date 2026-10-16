package com.mosharrof.agent.execution

import java.util.concurrent.atomic.AtomicBoolean

/** A bounded, explicit task step. Platform-specific work is supplied by a trusted adapter. */
data class TaskStep(
    val id: String,
    val description: String,
    val requiresConfirmation: Boolean = true,
    val timeoutMillis: Long = 8_000,
    val maxAttempts: Int = 1
) {
    init {
        require(id.isNotBlank())
        require(description.isNotBlank())
        require(timeoutMillis in 1..60_000)
        require(maxAttempts in 1..3)
    }
}

enum class TaskRunState { IDLE, RUNNING, SUCCEEDED, FAILED, CANCELLED }

enum class StepState { SUCCEEDED, FAILED, NEEDS_CONFIRMATION, TIMED_OUT, CANCELLED }

data class StepReport(
    val stepId: String,
    val state: StepState,
    val attempts: Int,
    val message: String
)

data class TaskRunReport(
    val state: TaskRunState,
    val steps: List<StepReport>,
    val message: String
)

sealed interface StepOutcome {
    data object Completed : StepOutcome
    data class Failed(val reason: String) : StepOutcome
}

/** Executes a user-approved sequence in order and stops on ambiguity, failure, timeout or cancel. */
interface TaskStepAdapter {
    fun execute(step: TaskStep): StepOutcome
    fun verifyPostcondition(step: TaskStep): Boolean
}

fun interface TaskClock {
    fun nowMillis(): Long
}

class TaskExecutionCoordinator(
    private val maxSteps: Int = 12,
    private val clock: TaskClock = TaskClock { System.nanoTime() / 1_000_000 }
) {
    private val cancellationRequested = AtomicBoolean(false)

    @Volatile
    var state: TaskRunState = TaskRunState.IDLE
        private set

    fun cancel() {
        cancellationRequested.set(true)
    }

    fun execute(
        steps: List<TaskStep>,
        approvedStepIds: Set<String>,
        adapter: TaskStepAdapter
    ): TaskRunReport {
        if (state != TaskRunState.IDLE) {
            return TaskRunReport(state, emptyList(), "এই task controller ইতিমধ্যে ব্যবহার করা হয়েছে।")
        }
        if (steps.isEmpty()) return finish(TaskRunState.FAILED, emptyList(), "কোনো কাজের ধাপ দেওয়া হয়নি।")
        if (steps.size > maxSteps) {
            return finish(TaskRunState.FAILED, emptyList(), "নিরাপত্তার জন্য ধাপের সর্বোচ্চ সীমা অতিক্রম করেছে।")
        }
        if (steps.map { it.id }.toSet().size != steps.size) {
            return finish(TaskRunState.FAILED, emptyList(), "একই step ID একাধিকবার আছে; কাজ শুরু করা হয়নি।")
        }

        state = TaskRunState.RUNNING
        val reports = mutableListOf<StepReport>()
        for (step in steps) {
            if (cancellationRequested.get()) {
                reports += StepReport(step.id, StepState.CANCELLED, 0, "ব্যবহারকারীর অনুরোধে কাজ বাতিল হয়েছে।")
                return finish(TaskRunState.CANCELLED, reports, "কাজ বাতিল হয়েছে; পরের ধাপ চালানো হয়নি।")
            }
            if (step.requiresConfirmation && step.id !in approvedStepIds) {
                reports += StepReport(step.id, StepState.NEEDS_CONFIRMATION, 0, "এই ধাপের জন্য স্পষ্ট অনুমোদন প্রয়োজন।")
                return finish(TaskRunState.FAILED, reports, "অনুমোদন না থাকায় কাজ থামানো হয়েছে।")
            }

            val startedAt = clock.nowMillis()
            var attempts = 0
            var completed = false
            var failure = "কাজটি সফল হয়নি।"
            while (attempts < step.maxAttempts && !completed) {
                if (cancellationRequested.get()) {
                    reports += StepReport(step.id, StepState.CANCELLED, attempts, "ব্যবহারকারীর অনুরোধে কাজ বাতিল হয়েছে।")
                    return finish(TaskRunState.CANCELLED, reports, "কাজ বাতিল হয়েছে।")
                }
                if (clock.nowMillis() - startedAt >= step.timeoutMillis) {
                    reports += StepReport(step.id, StepState.TIMED_OUT, attempts, "ধাপটির সময়সীমা শেষ হয়েছে; আর চেষ্টা করা হয়নি।")
                    return finish(TaskRunState.FAILED, reports, "সময়সীমা শেষ হওয়ায় কাজ থামানো হয়েছে।")
                }
                attempts += 1
                when (val outcome = runCatching { adapter.execute(step) }.getOrElse {
                    StepOutcome.Failed(it.message ?: "অজানা ত্রুটি")
                }) {
                    StepOutcome.Completed -> {
                        if (clock.nowMillis() - startedAt >= step.timeoutMillis) {
                            reports += StepReport(step.id, StepState.TIMED_OUT, attempts, "ধাপটি নির্ধারিত সময়ের পরে ফিরেছে।")
                            return finish(TaskRunState.FAILED, reports, "সময়সীমা অতিক্রম করেছে।")
                        }
                        completed = runCatching { adapter.verifyPostcondition(step) }.getOrDefault(false)
                        if (!completed) failure = "কাজের পরের অবস্থা যাচাই করা যায়নি।"
                    }
                    is StepOutcome.Failed -> failure = outcome.reason
                }
            }
            if (!completed) {
                reports += StepReport(step.id, StepState.FAILED, attempts, failure)
                return finish(TaskRunState.FAILED, reports, "একটি ধাপ ব্যর্থ হয়েছে; নিরাপত্তার জন্য পরের ধাপ চালানো হয়নি।")
            }
            reports += StepReport(step.id, StepState.SUCCEEDED, attempts, "কাজ সম্পন্ন এবং ফলাফল যাচাই হয়েছে।")
        }
        return finish(TaskRunState.SUCCEEDED, reports, "সব ধাপ সম্পন্ন এবং যাচাই হয়েছে।")
    }

    private fun finish(state: TaskRunState, reports: List<StepReport>, message: String): TaskRunReport {
        this.state = state
        return TaskRunReport(state, reports.toList(), message)
    }
}
