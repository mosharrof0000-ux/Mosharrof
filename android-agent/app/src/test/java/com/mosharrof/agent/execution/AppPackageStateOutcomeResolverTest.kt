package com.mosharrof.agent.execution

import android.app.Activity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppPackageStateOutcomeResolverTest {
    @Test
    fun newlyInstalledMatchingVersionIsVerifiedEvenIfInstallerResultIsAmbiguous() {
        val result = AppPackageStateOutcomeResolver.resolve(
            pending(AppPackageTaskAction.INSTALL_APK, wasInstalled = false, expectedVersionCode = 7),
            Activity.RESULT_CANCELED,
            installedVersionCode = 7
        )
        assertEquals(AppPackageTaskStatus.SUCCEEDED, result.status)
        assertTrue(result.packageStateVerified)
    }

    @Test
    fun existingSameVersionIsNotReportedAsSuccessAfterCancellation() {
        val result = AppPackageStateOutcomeResolver.resolve(
            pending(AppPackageTaskAction.INSTALL_APK, wasInstalled = true, expectedVersionCode = 7, previousVersionCode = 7),
            Activity.RESULT_CANCELED,
            installedVersionCode = 7
        )
        assertEquals(AppPackageTaskStatus.CANCELLED, result.status)
        assertFalse(result.packageStateVerified)
    }

    @Test
    fun mismatchedInstalledVersionIsNeverReportedAsSuccess() {
        val result = AppPackageStateOutcomeResolver.resolve(
            pending(AppPackageTaskAction.INSTALL_APK, wasInstalled = false, expectedVersionCode = 7),
            Activity.RESULT_OK,
            installedVersionCode = 8
        )
        assertEquals(AppPackageTaskStatus.UNKNOWN, result.status)
        assertFalse(result.packageStateVerified)
    }

    @Test
    fun removedPreviouslyInstalledPackageIsVerifiedAsUninstalled() {
        val result = AppPackageStateOutcomeResolver.resolve(
            pending(AppPackageTaskAction.UNINSTALL_APP, wasInstalled = true, previousVersionCode = 2),
            Activity.RESULT_CANCELED,
            installedVersionCode = null
        )
        assertEquals(AppPackageTaskStatus.SUCCEEDED, result.status)
        assertTrue(result.packageStateVerified)
    }

    @Test
    fun cancellationWithPackageStillInstalledIsNotSuccess() {
        val result = AppPackageStateOutcomeResolver.resolve(
            pending(AppPackageTaskAction.UNINSTALL_APP, wasInstalled = true, previousVersionCode = 2),
            Activity.RESULT_CANCELED,
            installedVersionCode = 2
        )
        assertEquals(AppPackageTaskStatus.CANCELLED, result.status)
        assertFalse(result.packageStateVerified)
    }

    @Test
    fun missingPackageWithoutPriorInstallEvidenceIsNotSuccess() {
        val result = AppPackageStateOutcomeResolver.resolve(
            pending(AppPackageTaskAction.UNINSTALL_APP, wasInstalled = false),
            Activity.RESULT_OK,
            installedVersionCode = null
        )
        assertEquals(AppPackageTaskStatus.FAILED, result.status)
        assertFalse(result.packageStateVerified)
    }

    private fun pending(
        action: AppPackageTaskAction,
        wasInstalled: Boolean,
        expectedVersionCode: Long? = null,
        previousVersionCode: Long? = null
    ) = PendingAppPackageOperation(
        requestId = "request-123",
        action = action,
        packageName = "com.example.target",
        expectedVersionCode = expectedVersionCode,
        wasInstalled = wasInstalled,
        previousVersionCode = previousVersionCode
    )
}
