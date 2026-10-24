package com.mosharrof.agent.execution

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppPackageStateVerifierTest {
    @Test fun installSucceedsOnlyWhenExactlyOneNewPackageAppears() {
        val result = AppPackageStateVerifier.resolve(
            "install-1", AppPackageTaskAction.INSTALL_APK, null,
            setOf("com.mosharrof.agent"),
            setOf("com.mosharrof.agent", "com.example.newapp")
        )
        assertEquals(AppPackageTaskStatus.SUCCEEDED, result.status)
        assertTrue(result.packageStateVerified)
        assertEquals("com.example.newapp", result.packageName)
    }

    @Test fun ambiguousInstallNeverClaimsSuccess() {
        val result = AppPackageStateVerifier.resolve(
            "install-2", AppPackageTaskAction.INSTALL_APK, null,
            setOf("com.mosharrof.agent"),
            setOf("com.mosharrof.agent", "com.example.one", "com.example.two")
        )
        assertEquals(AppPackageTaskStatus.UNKNOWN, result.status)
        assertFalse(result.packageStateVerified)
    }

    @Test fun uninstallSucceedsOnlyWhenTargetIsAbsentAfterReturn() {
        val success = AppPackageStateVerifier.resolve(
            "remove-1", AppPackageTaskAction.UNINSTALL_APP, "com.example.target",
            setOf("com.mosharrof.agent", "com.example.target"),
            setOf("com.mosharrof.agent")
        )
        assertEquals(AppPackageTaskStatus.SUCCEEDED, success.status)
        assertTrue(success.packageStateVerified)

        val uncertain = AppPackageStateVerifier.resolve(
            "remove-2", AppPackageTaskAction.UNINSTALL_APP, "com.example.target",
            setOf("com.mosharrof.agent", "com.example.target"),
            setOf("com.mosharrof.agent", "com.example.target")
        )
        assertEquals(AppPackageTaskStatus.UNKNOWN, uncertain.status)
        assertFalse(uncertain.packageStateVerified)
    }

    @Test fun playStoreSearchNeverClaimsInstallSuccess() {
        val result = AppPackageStateVerifier.resolve(
            "search-1", AppPackageTaskAction.SEARCH_PLAY_STORE, null, emptySet(), emptySet()
        )
        assertEquals(AppPackageTaskStatus.UNKNOWN, result.status)
        assertFalse(result.packageStateVerified)
    }
}
