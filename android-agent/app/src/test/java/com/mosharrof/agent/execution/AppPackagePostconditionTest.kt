package com.mosharrof.agent.execution

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppPackagePostconditionTest {
    private fun pending(action: AppPackageTaskAction, packageName: String? = "com.example.app") =
        AppPackageTaskResult(
            requestId = "request-123",
            action = action,
            status = AppPackageTaskStatus.AWAITING_USER_CONFIRMATION,
            detail = "Waiting for Android confirmation",
            packageName = packageName
        )

    @Test fun newInstallIsSuccessOnlyWhenPackageAppears() {
        val result = AppPackagePostcondition.reconcile(
            pending(AppPackageTaskAction.INSTALL_APK), -1L, 12L
        )
        assertEquals(AppPackageTaskStatus.SUCCEEDED, result.status)
        assertTrue(result.packageStateVerified)
    }

    @Test fun unchangedInstallStateIsNotSuccess() {
        val result = AppPackagePostcondition.reconcile(
            pending(AppPackageTaskAction.INSTALL_APK), 12L, 12L
        )
        assertEquals(AppPackageTaskStatus.UNKNOWN, result.status)
        assertFalse(result.packageStateVerified)
    }

    @Test fun installWithNoVisiblePackageIsNotSuccess() {
        val result = AppPackagePostcondition.reconcile(
            pending(AppPackageTaskAction.INSTALL_APK), -1L, null
        )
        assertEquals(AppPackageTaskStatus.UNKNOWN, result.status)
        assertFalse(result.packageStateVerified)
    }

    @Test fun upgradedPackageRequiresHigherVersionCode() {
        val result = AppPackagePostcondition.reconcile(
            pending(AppPackageTaskAction.INSTALL_APK), 12L, 13L
        )
        assertEquals(AppPackageTaskStatus.SUCCEEDED, result.status)
        assertTrue(result.packageStateVerified)
    }

    @Test fun removedPackageIsVerifiedUninstallSuccess() {
        val result = AppPackagePostcondition.reconcile(
            pending(AppPackageTaskAction.UNINSTALL_APP), 12L, null
        )
        assertEquals(AppPackageTaskStatus.SUCCEEDED, result.status)
        assertTrue(result.packageStateVerified)
    }

    @Test fun stillInstalledPackageIsNotUninstallSuccess() {
        val result = AppPackagePostcondition.reconcile(
            pending(AppPackageTaskAction.UNINSTALL_APP), 12L, 12L
        )
        assertEquals(AppPackageTaskStatus.UNKNOWN, result.status)
        assertFalse(result.packageStateVerified)
    }

    @Test fun playStoreSearchNeverBecomesInstallSuccess() {
        val result = AppPackagePostcondition.reconcile(
            pending(AppPackageTaskAction.SEARCH_PLAY_STORE, null), null, null
        )
        assertEquals(AppPackageTaskStatus.UNKNOWN, result.status)
        assertFalse(result.packageStateVerified)
    }

    @Test fun installRequiresExactTargetVersionWhenKnown() {
        val result = AppPackagePostcondition.reconcile(
            pending(AppPackageTaskAction.INSTALL_APK), 12L, 14L, targetVersionCode = 13L
        )
        assertEquals(AppPackageTaskStatus.UNKNOWN, result.status)
        assertFalse(result.packageStateVerified)
    }

    @Test fun installConfirmsExactTargetVersionWhenItChanges() {
        val result = AppPackagePostcondition.reconcile(
            pending(AppPackageTaskAction.INSTALL_APK), 12L, 13L, targetVersionCode = 13L
        )
        assertEquals(AppPackageTaskStatus.SUCCEEDED, result.status)
        assertTrue(result.packageStateVerified)
    }

}
