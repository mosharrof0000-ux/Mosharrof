package com.mosharrof.agent.files

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FileRiskScannerTest {
    @Test fun flagsDoubleExtensionExecutable() {
        val finding = FileRiskScanner.inspect("holiday.jpg.apk", "image/jpeg")
        assertEquals(FileRiskLevel.HIGH, finding.level)
        assertTrue(finding.reasons.any { it.contains("executable extension") })
    }

    @Test fun flagsInstallablePackagesForReview() {
        assertEquals(FileRiskLevel.ELEVATED, FileRiskScanner.inspect("unknown.apk").level)
    }

    @Test fun doesNotClaimUnknownFilesAreSafe() {
        val finding = FileRiskScanner.inspect("unknown.bin")
        assertTrue(finding.reasons.any { it.contains("নিরাপদ বলে নিশ্চিত") })
    }
}
