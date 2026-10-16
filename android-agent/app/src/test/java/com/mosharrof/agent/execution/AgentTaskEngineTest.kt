package com.mosharrof.agent.execution

import org.junit.Assert.*
import org.junit.Test

class AgentTaskEngineTest {
    private class FakeAdapter : AgentTaskAdapter {
        val executed = mutableListOf<AgentTaskStep>()
        var targetValid = true
        var failure: StepResult? = null
        override fun revalidate(step: AgentTaskStep) = targetValid
        override fun execute(step: AgentTaskStep): StepResult {
            executed += step
            return failure ?: StepResult(StepStatus.SUCCESS, "ok")
        }
    }

    @Test fun executesBoundedApprovedStepsInOrder() {
        val adapter = FakeAdapter()
        val steps = listOf(AgentTaskStep.OpenApp("com.example"),
            AgentTaskStep.Swipe("com.example", AgentTaskStep.Direction.DOWN))
        val report = AgentTaskEngine(adapter, TaskApprovalGate { true }, TaskCancellation { false }).execute(steps)
        assertTrue(report.succeeded)
        assertEquals(2, report.completedSteps)
        assertEquals(steps, adapter.executed)
    }

    @Test fun stopsBeforeExecutionWhenApprovalIsMissing() {
        val adapter = FakeAdapter()
        val report = AgentTaskEngine(adapter, TaskApprovalGate { false }, TaskCancellation { false })
            .execute(listOf(AgentTaskStep.OpenApp("com.example")))
        assertEquals(StepStatus.NEEDS_CONFIRMATION, report.results.single().status)
        assertTrue(adapter.executed.isEmpty())
    }

    @Test fun stopsWhenTargetHasChanged() {
        val adapter = FakeAdapter().apply { targetValid = false }
        val report = AgentTaskEngine(adapter, TaskApprovalGate { true }, TaskCancellation { false })
            .execute(listOf(AgentTaskStep.OpenApp("com.example")))
        assertEquals(StepStatus.STALE_TARGET, report.results.single().status)
        assertTrue(adapter.executed.isEmpty())
    }

    @Test fun cancellationStopsBeforeNextStep() {
        val adapter = FakeAdapter()
        var checks = 0
        val report = AgentTaskEngine(adapter, TaskApprovalGate { true }, TaskCancellation { ++checks > 1 })
            .execute(listOf(AgentTaskStep.OpenApp("com.example"),
                AgentTaskStep.Swipe("com.example", AgentTaskStep.Direction.UP)))
        assertEquals(1, report.completedSteps)
        assertTrue(report.cancelled)
        assertEquals(1, adapter.executed.size)
    }

    @Test fun highRiskStepsFailClosedEvenIfApprovalAdapterSaysYes() {
        val adapter = FakeAdapter()
        val highRisk = object : AgentTaskStep {
            override val description = "delete"
            override val risk = AgentTaskStep.Risk.HIGH
        }
        val report = AgentTaskEngine(adapter, TaskApprovalGate { true }, TaskCancellation { false })
            .execute(listOf(highRisk))
        assertEquals(StepStatus.NEEDS_CONFIRMATION, report.results.single().status)
        assertTrue(adapter.executed.isEmpty())
    }

    @Test fun rejectsOverlongPlans() {
        val adapter = FakeAdapter()
        val steps = (1..9).map { AgentTaskStep.OpenApp("app.$it") }
        val report = AgentTaskEngine(adapter, TaskApprovalGate { true }, TaskCancellation { false }).execute(steps)
        assertFalse(report.succeeded)
        assertTrue(adapter.executed.isEmpty())
    }
}
