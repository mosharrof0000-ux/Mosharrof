package com.mosharrof.agent.integration

/**
 * Stable, provider-neutral boundary for a future MOSHARROF AI plugin.
 *
 * This contract intentionally contains no network client and cannot execute
 * arbitrary shell commands. Implementations must route approved commands to
 * the existing local policy and Android action adapters.
 */
interface AndroidControlPlugin {
    fun capabilities(): Set<ControlCapability>

    suspend fun submit(
        command: PluginCommand,
        localApproval: LocalApproval? = null
    ): PluginCommandResult
}

enum class ControlCapability {
    OPEN_INSTALLED_APP,
    INSPECT_CURRENT_SCREEN,
    NAVIGATE_BACK,
    TAP_EXACT_LABEL,
    SWIPE
}

enum class ControlAction {
    OPEN_APP,
    INSPECT_SCREEN,
    NAVIGATE_BACK,
    TAP_EXACT_LABEL,
    SWIPE
}

enum class SwipeDirection { UP, DOWN, LEFT, RIGHT }

data class PluginCommand(
    val requestId: String,
    val action: ControlAction,
    val targetApp: String? = null,
    val exactLabel: String? = null,
    val swipeDirection: SwipeDirection? = null
)

/**
 * Approval is produced by the Android app's own visible confirmation UI,
 * never by a remote model or caller-supplied Boolean.
 */
data class LocalApproval internal constructor(val requestId: String)

enum class PluginResultStatus {
    COMPLETED,
    NEEDS_LOCAL_CONFIRMATION,
    REJECTED,
    FAILED
}

data class PluginCommandResult(
    val requestId: String,
    val status: PluginResultStatus,
    val message: String
)
