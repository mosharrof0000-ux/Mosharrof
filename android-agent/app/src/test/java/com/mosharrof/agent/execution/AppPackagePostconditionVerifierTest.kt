package com.mosharrof.agent.execution

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AppPackagePostconditionVerifierTest {
    @Test fun installSucceedsOnlyWhenExpectedVersionIsObserved() {
        val pending = PendingAppPackageOperation(
            "install-1", AppPackageTaskAction.INSTALL_APK, "com.example.app",
            expectedVersionCode = 7L, initialVersionCode = 6L
        )
        val result = AppPackagePostconditionVerifier.install(pending, 7L, resultCodeOk = false)
        assertEquals(AppPackageTaskStatus.SUCCEEDED, result.status)
        assertTrue(result.packageStateVerified)
    }

    @Test fun cancelledReinstallDoesNotClaimSuccessForUnchangedExistingVersion() {
        val pending = PendingAppPackageOperation(
            "install-2", AppPackageTaskAction.INSTALL_APK, "com.example.app",
            expectedVersionCode = 7L, initialVersionCode = 7L
        )
        val result = AppPackagePostconditionVerifier.install(pending, 7L, resultCodeOk = false)
        assertEquals(AppPackageTaskStatus.CANCELLED, result.status)
        assertTrue(!result.packageStateVerified)
    }

    @Test fun installMismatchNeverClaimsSuccess() {
        val pending = PendingAppPackageOperation(
            "install-3", AppPackageTaskAction.INSTALL_APK, "com.example.app",
            expectedVersionCode = 7L, initialVersionCode = null
        )
        val result = AppPackagePostconditionVerifier.install(pending, 6L, resultCodeOk = true)
        assertEquals(AppPackageTaskStatus.FAILED, result.status)
        assertTrue(!result.packageStateVerified)
    }

    @Test fun uninstallSucceedsOnlyWhenPackageIsAbsent() {
        val pending = PendingAppPackageOperation("uninstall-1", AppPackageTaskAction.UNINSTALL_APP, "com.example.app")
        val result = AppPackagePostconditionVerifier.uninstall(pending, packageStillInstalled = false, resultCodeOk = false)
        assertEquals(AppPackageTaskStatus.SUCCEEDED, result.status)
        assertTrue(result.packageStateVerified)
    }

    @Test fun cancelledUninstallWithPackageStillPresentIsCancelled() {
        val pending = PendingAppPackageOperation("uninstall-2", AppPackageTaskAction.UNINSTALL_APP, "com.example.app")
        val result = AppPackagePostconditionVerifier.uninstall(pending, packageStillInstalled = true, resultCodeOk = false)
        assertEquals(AppPackageTaskStatus.CANCELLED, result.status)
        assertTrue(!result.packageStateVerified)
    }
    @Test fun uninstallResultCodeAloneCannotOverrideObservedInstalledPackage() {
        val pending = PendingAppPackageOperation("uninstall-3", AppPackageTaskAction.UNINSTALL_APP, "com.example.app")
        val result = AppPackagePostconditionVerifier.uninstall(pending, packageStillInstalled = true, resultCodeOk = true)
        assertEquals(AppPackageTaskStatus.FAILED, result.status)
        assertTrue(!result.packageStateVerified)
    }

}
