package com.mosharrof.agent.execution

/**
 * Pure, deterministic interpretation of package state after Android's confirmation UI returns.
 * Ambiguous outcomes are UNKNOWN rather than guessed success/cancellation.
 */
object AppPackageOutcomeVerifier {
    fun afterInstall(
        expectedVersionCode: Long,
        previousVersionCode: Long?,
        currentVersionCode: Long?
    ): AppPackageTaskResult {
        val installedExpectedVersion = currentVersionCode == expectedVersionCode
        val stateChangedAsExpected = previousVersionCode == null || currentVersionCode != previousVersionCode
        return if (installedExpectedVersion && stateChangedAsExpected) {
            AppPackageTaskResult(
                requestId = "verification",
                action = AppPackageTaskAction.INSTALL_APK,
                status = AppPackageTaskStatus.SUCCEEDED,
                detail = "APK package and version were verified after returning from Android installer.",
                packageStateVerified = true,
                expectedVersionCode = expectedVersionCode,
                previousVersionCode = previousVersionCode
            )
        } else {
            AppPackageTaskResult(
                requestId = "verification",
                action = AppPackageTaskAction.INSTALL_APK,
                status = AppPackageTaskStatus.UNKNOWN,
                detail = "Install outcome is not conclusive: package state did not prove a new install/update.",
                expectedVersionCode = expectedVersionCode,
                previousVersionCode = previousVersionCode
            )
        }
    }

    fun afterUninstall(packageName: String, isStillInstalled: Boolean): AppPackageTaskResult =
        if (!isStillInstalled) {
            AppPackageTaskResult(
                requestId = "verification",
                action = AppPackageTaskAction.UNINSTALL_APP,
                status = AppPackageTaskStatus.SUCCEEDED,
                detail = "Package absence was verified after returning from Android uninstaller.",
                packageName = packageName,
                packageStateVerified = true
            )
        } else {
            AppPackageTaskResult(
                requestId = "verification",
                action = AppPackageTaskAction.UNINSTALL_APP,
                status = AppPackageTaskStatus.UNKNOWN,
                detail = "Package is still installed; Android cancellation and uninstall failure cannot be distinguished.",
                packageName = packageName
            )
        }
}
