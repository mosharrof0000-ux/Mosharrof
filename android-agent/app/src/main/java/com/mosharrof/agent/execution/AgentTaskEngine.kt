package com.mosharrof.agent.execution

/** Bounded orchestration for user-approved Android tasks. */
sealed interface AgentTaskStep {
    val description: String
    val risk: Risk
    data class OpenApp(val packageName: String) : AgentTaskStep {
        override val description = "অ্যাপ খোলা"
        override val risk = Risk.LOW
    }
    data class TapLabel(val packageName: String, val label: String) : AgentTaskStep {
        override val description = "স্ক্রিনের নির্দিষ্ট লেবেলে ট্যাপ"
        override val risk = Risk.MEDIUM
    }
    data class Swipe(val packageName: String, val direction: Direction) : AgentTaskStep {
        override val description = "স্ক্রিন স্ক্রল"
        override val risk = Risk.LOW
    }
    data object InspectScreen : AgentTaskStep {
        override val description = "স্ক্রিন পরীক্ষা"
        override val risk = Risk.LOW
    }
    enum class Direction { UP, DOWN, LEFT, RIGHT }
    enum class Risk { LOW, MEDIUM, HIGH }
}

enum class StepStatus { SUCCESS, FAILED, CANCELLED, NEEDS_CONFIRMATION, STALE_TARGET }
data class StepResult(val status: StepStatus, val message: String, val observedState: String? = null)
data class TaskExecutionReport(
    val completedSteps: Int,
    val totalSteps: Int,
    val cancelled: Boolean,
    val stoppedAtStep: Int?,
    val results: List<StepResult>
) {
    val succeeded: Boolean
        get() = !cancelled && completedSteps == totalSteps &&
            results.all { it.status == StepStatus.SUCCESS }
}

interface AgentTaskAdapter {
    fun revalidate(step: AgentTaskStep): Boolean
    fun execute(step: AgentTaskStep): StepResult
}
fun interface TaskApprovalGate { fun approved(step: AgentTaskStep): Boolean }
fun interface TaskCancellation { fun isCancelled(): Boolean }

/** Fails closed on missing approval, stale targets, cancellation, and excessive plan length. */
class AgentTaskEngine(
    private val adapter: AgentTaskAdapter,
    private val approvalGate: TaskApprovalGate,
    private val cancellation: TaskCancellation,
    private val maxSteps: Int = DEFAULT_MAX_STEPS
) {
    init { require(maxSteps in 1..HARD_MAX_STEPS) }

    fun execute(steps: List<AgentTaskStep>): TaskExecutionReport {
        if (steps.isEmpty() || steps.size > maxSteps) {
            return TaskExecutionReport(0, steps.size, false, 0, listOf(StepResult(
                StepStatus.FAILED,
                if (steps.isEmpty()) "কোনো কাজ নির্ধারিত হয়নি।"
                else "একটি কাজে সর্বোচ্চ $maxStepsটি ধাপ অনুমোদিত।"
            )))
        }
        val results = mutableListOf<StepResult>()
        var completed = 0
        steps.forEachIndexed { index, step ->
            if (cancellation.isCancelled()) {
                results += StepResult(StepStatus.CANCELLED, "ব্যবহারকারী কাজ বাতিল করেছেন।")
                return TaskExecutionReport(completed, steps.size, true, index, results)
            }
            if (step.risk == AgentTaskStep.Risk.HIGH || !approvalGate.approved(step)) {
                results += StepResult(
                    StepStatus.NEEDS_CONFIRMATION,
                    "এই ধাপের জন্য স্পষ্ট ব্যবহারকারী অনুমোদন প্রয়োজন: ${step.description}"
                )
                return TaskExecutionReport(completed, steps.size, false, index, results)
            }
            if (!adapter.revalidate(step)) {
                results += StepResult(
                    StepStatus.STALE_TARGET,
                    "লক্ষ্য অ্যাপ/স্ক্রিন বদলে গেছে; নিরাপত্তার জন্য কাজ থামানো হয়েছে।"
                )
                return TaskExecutionReport(completed, steps.size, false, index, results)
            }
            val result = adapter.execute(step)
            results += result
            if (result.status != StepStatus.SUCCESS) {
                return TaskExecutionReport(completed, steps.size, false, index, results)
            }
            completed += 1
        }
        return TaskExecutionReport(completed, steps.size, false, null, results)
    }
    companion object { const val DEFAULT_MAX_STEPS = 8; const val HARD_MAX_STEPS = 20 }
}
