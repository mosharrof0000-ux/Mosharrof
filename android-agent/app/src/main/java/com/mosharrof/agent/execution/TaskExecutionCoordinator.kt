package com.mosharrof.agent.execution.coordinator
import java.util.concurrent.Callable
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/** A bounded, explicit task step. Platform-specific work is supplied by a trusted adapter. */
data class TaskStep(
    val id: String,
    val description: String,
    val requiresConfirmation: Boolean = true,
    val timeoutMillis: Long = 8_000,
    val maxAttempts: Int = 1,
    val retrySafe: Boolean = false
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

/** The adapter must use supported Android APIs and verify the actual resulting state. */
interface TaskStepAdapter {
    fun execute(step: TaskStep): StepOutcome
    fun verifyPostcondition(step: TaskStep): Boolean
}

fun interface TaskClock {
    fun nowMillis(): Long
}

/**
 * Single-use coordinator: bounded steps, explicit approvals, cancellation checkpoints,
 * per-step deadlines and postcondition verification. It never retries a non-idempotent action.
 */
class TaskExecutionCoordinator(
    private val maxSteps: Int = 12,
    private val clock: TaskClock = TaskClock { System.nanoTime() / 1_000_000 }
) {
    private val cancellationRequested = AtomicBoolean(false)
    private val activeStepTask = AtomicReference<FutureTask<Pair<StepOutcome, Boolean>>?>(null)

    @Volatile
    var state: TaskRunState = TaskRunState.IDLE
        private set

    fun cancel() {
        cancellationRequested.set(true)
        activeStepTask.get()?.cancel(true)
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
            val attemptLimit = if (step.retrySafe) step.maxAttempts else 1
            var attempts = 0
            var verified = false
            var failure = "কাজটি সফল হয়নি।"
            while (attempts < attemptLimit) {
                if (cancellationRequested.get()) {
                    reports += StepReport(step.id, StepState.CANCELLED, attempts, "ব্যবহারকারীর অনুরোধে কাজ বাতিল হয়েছে।")
                    return finish(TaskRunState.CANCELLED, reports, "কাজ বাতিল হয়েছে।")
                }
                if (clock.nowMillis() - startedAt >= step.timeoutMillis) {
                    reports += StepReport(step.id, StepState.TIMED_OUT, attempts, "ধাপটির সময়সীমা শেষ হয়েছে; আর চেষ্টা করা হয়নি।")
                    return finish(TaskRunState.FAILED, reports, "সময়সীমা শেষ হওয়ায় কাজ থামানো হয়েছে।")
                }

                attempts += 1
                val remainingMillis = (step.timeoutMillis - (clock.nowMillis() - startedAt)).coerceAtLeast(1)
                val task = FutureTask(Callable {
                    val result = runCatching { adapter.execute(step) }
                        .getOrElse { StepOutcome.Failed(it.message ?: "অজানা ত্রুটি") }
                    val postcondition = if (result == StepOutcome.Completed) {
                        runCatching { adapter.verifyPostcondition(step) }.getOrDefault(false)
                    } else false
                    result to postcondition
                })
                activeStepTask.set(task)
                Thread(task, "mosharrof-task-step-${step.id}").apply { isDaemon = true }.start()
                val result = try {
                    task.get(remainingMillis, TimeUnit.MILLISECONDS)
                } catch (_: TimeoutException) {
                    task.cancel(true)
                    reports += StepReport(step.id, StepState.TIMED_OUT, attempts, "ধাপটির সময়সীমা শেষ হয়েছে; কাজ বাতিলের সংকেত পাঠানো হয়েছে।")
                    return finish(TaskRunState.FAILED, reports, "সময়সীমা শেষ; পরের ধাপ চালানো হয়নি।")
                } catch (e: InterruptedException) {
                    task.cancel(true)
                    Thread.currentThread().interrupt()
                    reports += StepReport(step.id, StepState.CANCELLED, attempts, "কাজের থ্রেড বন্ধের অনুরোধ পেয়েছে।")
                    return finish(TaskRunState.CANCELLED, reports, "কাজ বন্ধ করা হয়েছে।")
                } catch (e: java.util.concurrent.ExecutionException) {
                    StepOutcome.Failed(e.cause?.message ?: "অজানা ত্রুটি") to false
                } finally {
                    activeStepTask.compareAndSet(task, null)
                }

                when (val outcome = result.first) {
                    StepOutcome.Completed -> {
                        verified = result.second
                        if (verified) break
                        // Never repeat an action whose side effect may already have occurred.
                        failure = "কাজের পরের অবস্থা নিশ্চিত করা যায়নি; পুনরায় চালানো হয়নি।"
                        break
                    }
                    is StepOutcome.Failed -> {
                        failure = outcome.reason
                        if (!step.retrySafe) break
                    }
                }
            }

            if (!verified) {
                reports += StepReport(step.id, StepState.FAILED, attempts, failure)
                return finish(TaskRunState.FAILED, reports, "একটি ধাপ ব্যর্থ/যাচাই-অযোগ্য; পরের ধাপ চালানো হয়নি।")
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
