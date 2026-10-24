package com.mosharrof.agent.execution

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppPackageTaskResultTest {
    @Test fun requestIdIsPreservedForCorrelation() {
        val result = AppPackageTaskResult.awaitingConfirmation(
            requestId = "request-42",
            action = AppPackageTaskAction.UNINSTALL_APP,
            detail = "Android confirmation screen required",
            packageName = "com.example.target"
        )
        assertTrue(result.requestId == "request-42")
        assertFalse(result.isTerminal)
    }

    @Test fun onlyExplicitOutcomeStatusesAreTerminal() {
        assertFalse(result(AppPackageTaskStatus.REQUESTED).isTerminal)
        assertFalse(result(AppPackageTaskStatus.AWAITING_USER_CONFIRMATION).isTerminal)
        assertTrue(result(AppPackageTaskStatus.CANCELLED).isTerminal)
        assertTrue(result(AppPackageTaskStatus.FAILED).isTerminal)
        assertTrue(result(AppPackageTaskStatus.TIMED_OUT).isTerminal)
        assertTrue(result(AppPackageTaskStatus.UNKNOWN).isTerminal)
    }

    @Test(expected = IllegalArgumentException::class)
    fun cannotClaimSuccessWithoutVerifiedPackageState() {
        result(AppPackageTaskStatus.SUCCEEDED, packageStateVerified = false)
    }

    @Test(expected = IllegalArgumentException::class)
    fun playStoreSearchCannotClaimInstallSuccess() {
        AppPackageTaskResult(
            requestId = "request-1",
            action = AppPackageTaskAction.SEARCH_PLAY_STORE,
            status = AppPackageTaskStatus.SUCCEEDED,
            detail = "Search opened",
            packageStateVerified = true
        )
    }

    @Test(expected = IllegalArgumentException::class)
    fun rejectsMalformedPackageNames() {
        AppPackageTaskResult(
            requestId = "request-1",
            action = AppPackageTaskAction.UNINSTALL_APP,
            status = AppPackageTaskStatus.REQUESTED,
            detail = "Uninstall request",
            packageName = "not a package name"
        )
    }

    private fun result(
        status: AppPackageTaskStatus,
        packageStateVerified: Boolean = false
    ) = AppPackageTaskResult(
        requestId = "request-1",
        action = AppPackageTaskAction.INSTALL_APK,
        status = status,
        detail = "test result",
        packageStateVerified = packageStateVerified
    )
}
