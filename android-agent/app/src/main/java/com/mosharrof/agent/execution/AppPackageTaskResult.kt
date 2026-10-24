package com.mosharrof.agent.execution

/**
 * Correlated, explicit outcome for an app-package request.
 *
 * A command being dispatched or an Android confirmation screen opening is not success.
 * Callers may report SUCCEEDED only after the package state has been independently verified.
 */
enum class AppPackageTaskStatus {
    REQUESTED,
    AWAITING_USER_CONFIRMATION,
    SUCCEEDED,
    FAILED,
    CANCELLED,
    TIMED_OUT,
    UNKNOWN
}

enum class AppPackageTaskAction {
    INSTALL_APK,
    SEARCH_PLAY_STORE,
    UNINSTALL_APP
}

data class AppPackageTaskResult(
    val requestId: String,
    val action: AppPackageTaskAction,
    val status: AppPackageTaskStatus,
    val detail: String,
    val packageName: String? = null,
    val packageStateVerified: Boolean = false
) {
    init {
        require(requestId.isNotBlank()) { "requestId must not be blank" }
        require(requestId.length <= 128) { "requestId is too long" }
        require(detail.length <= 500) { "detail is too long" }
        require(packageName == null || PACKAGE_NAME.matches(packageName)) {
            "packageName must be a valid Android package name"
        }
        require(status != AppPackageTaskStatus.SUCCEEDED || packageStateVerified) {
            "SUCCEEDED requires verified package state"
        }
        require(status != AppPackageTaskStatus.SUCCEEDED || action != AppPackageTaskAction.SEARCH_PLAY_STORE) {
            "Opening a Play Store search cannot be reported as an installed app"
        }
    }

    val isTerminal: Boolean
        get() = status in TERMINAL_STATUSES

    companion object {
        private val TERMINAL_STATUSES = setOf(
            AppPackageTaskStatus.SUCCEEDED,
            AppPackageTaskStatus.FAILED,
            AppPackageTaskStatus.CANCELLED,
            AppPackageTaskStatus.TIMED_OUT,
            AppPackageTaskStatus.UNKNOWN
        )
        private val PACKAGE_NAME = Regex("[A-Za-z][A-Za-z0-9_]*(\\\\.[A-Za-z][A-Za-z0-9_]*)+")

        fun awaitingConfirmation(
            requestId: String,
            action: AppPackageTaskAction,
            detail: String,
            packageName: String? = null
        ) = AppPackageTaskResult(
            requestId = requestId,
            action = action,
            status = AppPackageTaskStatus.AWAITING_USER_CONFIRMATION,
            detail = detail,
            packageName = packageName
        )
    }
}
