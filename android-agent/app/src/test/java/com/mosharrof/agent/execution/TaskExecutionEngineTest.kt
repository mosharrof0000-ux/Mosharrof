package com.mosharrof.agent.execution

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TaskExecutionEngineTest {
    private class FakeDriver(
        var executeSuccess: Boolean = true,
        var verificationSuccess: Boolean = true,
        var recoverySuccess: Boolean = false
    ) : StepDriver {
        val executed = mutableListOf<String>()
        var recoveries = 0
        override fun execute(step: PlannedActionStep): StepOutcome {
            executed += step.id
            return StepOutcome(executeSuccess, if (executeSuccess) "ok" else "failed")
        }
        override fun verify(step: PlannedActionStep) = verificationSuccess
        override fun recover(step: PlannedActionStep): Boolean {
            recoveries++
            return recoverySuccess
        }
    }

    private fun step(id: String, risk: PlannedActionStep.Risk = PlannedActionStep.Risk.LOW) =
        PlannedActionStep(id, "ধাপ $id", risk, "ফলাফল $id")

    @Test
    fun executesAndVerifiesStepsInOrder() {
        val driver = FakeDriver()
        val result = TaskExecutionEngine(driver).execute(
            listOf(step("one"), step("two")), { false }, { true }
        )
        assertEquals(TaskExecutionReport.Status.SUCCEEDED, result.status)
        assertEquals(listOf("one", "two"), driver.executed)
        assertTrue(result.steps.all { it.status == StepReport.Status.SUCCEEDED })
    }

    @Test
    fun cancellationStopsBeforeNextStep() {
        val driver = FakeDriver()
        var checks = 0
        val result = TaskExecutionEngine(driver).execute(
            listOf(step("one"), step("two")), { ++checks >= 2 }, { true }
        )
        assertEquals(TaskExecutionReport.Status.CANCELLED, result.status)
        assertEquals(listOf("one"), driver.executed)
    }

    @Test
    fun consequentialStepRequiresApproval() {
        val driver = FakeDriver()
        val result = TaskExecutionEngine(driver).execute(
            listOf(step("send", PlannedActionStep.Risk.HIGH)), { false }, { false }
        )
        assertEquals(TaskExecutionReport.Status.CANCELLED, result.status)
        assertTrue(driver.executed.isEmpty())
        assertEquals(StepReport.Status.REJECTED, result.steps.single().status)
    }

    @Test
    fun failedActionAttemptsOneRecoveryAndStops() {
        val driver = FakeDriver(executeSuccess = false, recoverySuccess = true)
        val result = TaskExecutionEngine(driver).execute(listOf(step("one"), step("two")), { false }, { true })
        assertEquals(TaskExecutionReport.Status.CANCELLED, result.status)
        assertEquals(1, driver.recoveries)
        assertEquals(listOf("one"), driver.executed)
        assertFalse(result.steps.any { it.stepId == "two" })
    }

    @Test
    fun rejectsOversizedAndDuplicatePlans() {
        val driver = FakeDriver()
        val engine = TaskExecutionEngine(driver)
        val oversized = (1..13).map { step("step-$it") }
        assertEquals(TaskExecutionReport.Status.INVALID_PLAN, engine.execute(oversized, { false }, { true }).status)
        assertEquals(TaskExecutionReport.Status.INVALID_PLAN, engine.execute(listOf(step("same"), step("same")), { false }, { true }).status)
        assertTrue(driver.executed.isEmpty())
    }

    @Test
    fun failedPostconditionStopsAndAttemptsRecovery() {
        val driver = FakeDriver(verificationSuccess = false, recoverySuccess = false)
        val result = TaskExecutionEngine(driver).execute(listOf(step("one"), step("two")), { false }, { true })
        assertEquals(TaskExecutionReport.Status.FAILED, result.status)
        assertEquals(1, driver.recoveries)
        assertEquals(listOf("one"), driver.executed)
    }
}
