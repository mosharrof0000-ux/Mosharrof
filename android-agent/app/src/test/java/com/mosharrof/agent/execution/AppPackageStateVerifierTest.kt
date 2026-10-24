package com.mosharrof.agent.execution

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AppPackageStateVerifierTest {
    private fun pending(action: AppPackageTaskAction, packageName: String) = AppPackageTaskResult(
        requestId = "request-1",
        action = action,
        status = AppPackageTaskStatus.AWAITING_USER_CONFIRMATION,
        detail = "Waiting for Android confirmation",
        packageName = packageName
    )

    @Test fun installSucceedsOnlyWhenExpectedVersionIsNewlyVerified() {
        val result = AppPackageStateVerifier.evaluatePending(
            pending(AppPackageTaskAction.INSTALL_APK, "com.example.app"),
            installedVersionCode = 8L,
            expectedInstallVersionCode = 8L,
            baselineVersionCode = 7L
        )!!
        assertEquals(AppPackageTaskStatus.SUCCEEDED, result.status)
        assertTrue(result.packageStateVerified)
    }

    @Test fun installDoesNotSucceedWhenPackageIsMissingOrVersionUnchanged() {
        val missing = AppPackageStateVerifier.evaluatePending(
            pending(AppPackageTaskAction.INSTALL_APK, "com.example.app"),
            installedVersionCode = null,
            expectedInstallVersionCode = 8L,
            baselineVersionCode = null
        )!!
        assertEquals(AppPackageTaskStatus.FAILED, missing.status)
        assertFalse(missing.packageStateVerified)

        val unchanged = AppPackageStateVerifier.evaluatePending(
            pending(AppPackageTaskAction.INSTALL_APK, "com.example.app"),
            installedVersionCode = 8L,
            expectedInstallVersionCode = 8L,
            baselineVersionCode = 8L
        )!!
        assertEquals(AppPackageTaskStatus.FAILED, unchanged.status)
        assertFalse(unchanged.packageStateVerified)
    }

    @Test fun uninstallSucceedsOnlyWhenPackageIsAbsent() {
        val success = AppPackageStateVerifier.evaluatePending(
            pending(AppPackageTaskAction.UNINSTALL_APP, "com.example.app"),
            installedVersionCode = null
        )!!
        assertEquals(AppPackageTaskStatus.SUCCEEDED, success.status)
        assertTrue(success.packageStateVerified)

        val stillInstalled = AppPackageStateVerifier.evaluatePending(
            pending(AppPackageTaskAction.UNINSTALL_APP, "com.example.app"),
            installedVersionCode = 2L
        )!!
        assertEquals(AppPackageTaskStatus.FAILED, stillInstalled.status)
        assertFalse(stillInstalled.packageStateVerified)
    }

    @Test fun storeSearchAndNonPendingTasksAreNotResolvedAsPackageOperations() {
        assertNull(
            AppPackageStateVerifier.evaluatePending(
                pending(AppPackageTaskAction.SEARCH_PLAY_STORE, "com.example.app"),
                installedVersionCode = null
            )
        )
        val failed = pending(AppPackageTaskAction.UNINSTALL_APP, "com.example.app")
            .copy(status = AppPackageTaskStatus.FAILED)
        assertNull(AppPackageStateVerifier.evaluatePending(failed, installedVersionCode = null))
    }
}
