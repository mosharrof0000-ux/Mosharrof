package com.mosharrof.agent.execution.coordinator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TaskExecutionCoordinatorTest {
    private fun step(id: String, requiresConfirmation: Boolean = true) =
        TaskStep(id = id, description = "Test $id", requiresConfirmation = requiresConfirmation)

    @Test
    fun executesStepsInOrderAndVerifiesEachPostcondition() {
        val seen = mutableListOf<String>()
        val adapter = object : TaskStepAdapter {
            override fun execute(step: TaskStep): StepOutcome {
                seen += step.id
                return StepOutcome.Completed
            }
            override fun verifyPostcondition(step: TaskStep) = true
        }

        val report = TaskExecutionCoordinator().execute(
            listOf(step("open"), step("inspect")),
            setOf("open", "inspect"),
            adapter
        )

        assertEquals(TaskRunState.SUCCEEDED, report.state)
        assertEquals(listOf("open", "inspect"), seen)
        assertTrue(report.steps.all { it.state == StepState.SUCCEEDED })
    }

    @Test
    fun doesNotExecuteStepWithoutExplicitApproval() {
        var executed = false
        val adapter = object : TaskStepAdapter {
            override fun execute(step: TaskStep): StepOutcome {
                executed = true
                return StepOutcome.Completed
            }
            override fun verifyPostcondition(step: TaskStep) = true
        }

        val report = TaskExecutionCoordinator().execute(listOf(step("tap")), emptySet(), adapter)

        assertEquals(TaskRunState.FAILED, report.state)
        assertEquals(StepState.NEEDS_CONFIRMATION, report.steps.single().state)
        assertFalse(executed)
    }

    @Test
    fun doesNotRetryAnActionWhenPostconditionCannotBeVerified() {
        var executions = 0
        val adapter = object : TaskStepAdapter {
            override fun execute(step: TaskStep): StepOutcome {
                executions++
                return StepOutcome.Completed
            }
            override fun verifyPostcondition(step: TaskStep) = false
        }

        val report = TaskExecutionCoordinator().execute(
            listOf(step("send").copy(maxAttempts = 3, retrySafe = true)),
            setOf("send"),
            adapter
        )

        assertEquals(TaskRunState.FAILED, report.state)
        assertEquals(1, executions)
        assertEquals(StepState.FAILED, report.steps.single().state)
    }

    @Test
    fun cancellationStopsBeforeNextStep() {
        lateinit var coordinator: TaskExecutionCoordinator
        val seen = mutableListOf<String>()
        val adapter = object : TaskStepAdapter {
            override fun execute(step: TaskStep): StepOutcome {
                seen += step.id
                coordinator.cancel()
                return StepOutcome.Completed
            }
            override fun verifyPostcondition(step: TaskStep) = true
        }
        coordinator = TaskExecutionCoordinator()

        val report = coordinator.execute(
            listOf(step("first"), step("second")),
            setOf("first", "second"),
            adapter
        )

        assertEquals(TaskRunState.CANCELLED, report.state)
        assertEquals(listOf("first"), seen)
        assertEquals(StepState.CANCELLED, report.steps.last().state)
    }

    @Test
    fun timesOutBlockingAdapterAndDoesNotStartFollowingStep() {
        val seen = mutableListOf<String>()
        val adapter = object : TaskStepAdapter {
            override fun execute(step: TaskStep): StepOutcome {
                seen += step.id
                if (step.id == "slow") Thread.sleep(2_000)
                return StepOutcome.Completed
            }
            override fun verifyPostcondition(step: TaskStep) = true
        }

        val report = TaskExecutionCoordinator().execute(
            listOf(
                step("slow").copy(timeoutMillis = 100),
                step("must-not-run")
            ),
            setOf("slow", "must-not-run"),
            adapter
        )

        assertEquals(TaskRunState.FAILED, report.state)
        assertEquals(StepState.TIMED_OUT, report.steps.single().state)
        assertEquals(listOf("slow"), seen)
    }

    @Test
    fun rejectsDuplicateStepIdsBeforeRunning() {
        var executions = 0
        val adapter = object : TaskStepAdapter {
            override fun execute(step: TaskStep): StepOutcome {
                executions++
                return StepOutcome.Completed
            }
            override fun verifyPostcondition(step: TaskStep) = true
        }

        val report = TaskExecutionCoordinator().execute(
            listOf(step("same"), step("same")),
            setOf("same"),
            adapter
        )

        assertEquals(TaskRunState.FAILED, report.state)
        assertEquals(0, executions)
    }
}
