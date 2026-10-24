package com.mosharrof.agent.execution

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppPackageTaskResultVerifierTest {
    @Test fun installedPackageIsVerifiedAsSuccess() {
        val verified = AppPackageTaskResultVerifier.afterConfirmation(
            pending(AppPackageTaskAction.INSTALL_APK, "com.example.installed"),
            installed = true
        )
        assertEquals(AppPackageTaskStatus.SUCCEEDED, verified.status)
        assertTrue(verified.packageStateVerified)
    }

    @Test fun absentInstallTargetIsUnknownNotFalseSuccessOrDefiniteFailure() {
        val verified = AppPackageTaskResultVerifier.afterConfirmation(
            pending(AppPackageTaskAction.INSTALL_APK, "com.example.target"),
            installed = false
        )
        assertEquals(AppPackageTaskStatus.UNKNOWN, verified.status)
        assertFalse(verified.packageStateVerified)
    }

    @Test fun absentPackageIsVerifiedAsUninstalled() {
        val verified = AppPackageTaskResultVerifier.afterConfirmation(
            pending(AppPackageTaskAction.UNINSTALL_APP, "com.example.removed"),
            installed = false
        )
        assertEquals(AppPackageTaskStatus.SUCCEEDED, verified.status)
        assertTrue(verified.packageStateVerified)
    }

    @Test fun stillInstalledPackageDoesNotClaimUninstallSuccess() {
        val verified = AppPackageTaskResultVerifier.afterConfirmation(
            pending(AppPackageTaskAction.UNINSTALL_APP, "com.example.stillthere"),
            installed = true
        )
        assertEquals(AppPackageTaskStatus.UNKNOWN, verified.status)
        assertFalse(verified.packageStateVerified)
    }

    @Test fun unavailablePackageStateIsUnknown() {
        val verified = AppPackageTaskResultVerifier.afterConfirmation(
            pending(AppPackageTaskAction.INSTALL_APK, "com.example.target"),
            installed = null
        )
        assertEquals(AppPackageTaskStatus.UNKNOWN, verified.status)
        assertFalse(verified.packageStateVerified)
    }

    @Test fun unrelatedOrUncorrelatedResultsAreLeftUntouched() {
        val notPending = pending(AppPackageTaskAction.INSTALL_APK, "com.example.target")
            .copy(status = AppPackageTaskStatus.CANCELLED)
        assertEquals(notPending, AppPackageTaskResultVerifier.afterConfirmation(notPending, true))

        val noPackage = pending(AppPackageTaskAction.SEARCH_PLAY_STORE, null)
        assertEquals(noPackage, AppPackageTaskResultVerifier.afterConfirmation(noPackage, true))
    }

    private fun pending(action: AppPackageTaskAction, packageName: String?) = AppPackageTaskResult(
        requestId = "request-verify-1",
        action = action,
        status = AppPackageTaskStatus.AWAITING_USER_CONFIRMATION,
        detail = "Waiting for Android confirmation",
        packageName = packageName
    )
}
