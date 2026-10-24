package com.mosharrof.agent.execution

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppPackageOutcomeVerifierTest {
    @Test fun freshInstallIsSuccessfulOnlyWhenExpectedVersionIsPresent() {
        val result = AppPackageOutcomeVerifier.afterInstall(
            requestId = "install-1",
            packageName = "com.example.app",
            expectedVersionCode = 3L,
            previousVersionCode = null,
            currentVersionCode = 3L
        )
        assertEquals("install-1", result.requestId)
        assertEquals(AppPackageTaskStatus.SUCCEEDED, result.status)
        assertTrue(result.packageStateVerified)
    }

    @Test fun existingSameVersionDoesNotProduceFalseSuccess() {
        val result = AppPackageOutcomeVerifier.afterInstall(
            requestId = "install-2",
            packageName = "com.example.app",
            expectedVersionCode = 3L,
            previousVersionCode = 3L,
            currentVersionCode = 3L
        )
        assertEquals(AppPackageTaskStatus.UNKNOWN, result.status)
        assertFalse(result.packageStateVerified)
    }

    @Test fun updatedVersionIsVerified() {
        val result = AppPackageOutcomeVerifier.afterInstall(
            requestId = "install-3",
            packageName = "com.example.app",
            expectedVersionCode = 4L,
            previousVersionCode = 3L,
            currentVersionCode = 4L
        )
        assertEquals(AppPackageTaskStatus.SUCCEEDED, result.status)
    }

    @Test fun absentPackageVerifiesUninstall() {
        val result = AppPackageOutcomeVerifier.afterUninstall("uninstall-1", "com.example.app", false)
        assertEquals("uninstall-1", result.requestId)
        assertEquals(AppPackageTaskStatus.SUCCEEDED, result.status)
        assertTrue(result.packageStateVerified)
    }

    @Test fun stillInstalledPackageIsUnknownNotSuccess() {
        val result = AppPackageOutcomeVerifier.afterUninstall("uninstall-2", "com.example.app", true)
        assertEquals(AppPackageTaskStatus.UNKNOWN, result.status)
        assertFalse(result.packageStateVerified)
    }
}
