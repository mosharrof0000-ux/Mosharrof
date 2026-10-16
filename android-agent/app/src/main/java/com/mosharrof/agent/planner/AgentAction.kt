package com.mosharrof.agent.planner

/** Actions the planner may propose. Raw shell commands are intentionally not representable. */
sealed interface AgentAction {
    val targetPackage: String?

    data class OpenApp(
        val packageName: String,
        val userRequested: Boolean
    ) : AgentAction {
        override val targetPackage: String = packageName
    }

    data class TapSemanticNode(
        override val targetPackage: String,
        val resourceId: String? = null,
        val visibleText: String? = null,
        val contentDescription: String? = null
    ) : AgentAction

    data class Swipe(
        override val targetPackage: String,
        val direction: Direction
    ) : AgentAction

    data class TypeText(override val targetPackage: String, val text: String) : AgentAction

    data class GlobalNavigation(val destination: NavigationDestination) : AgentAction {
        override val targetPackage: String? = null
    }

    data object InspectScreen : AgentAction {
        override val targetPackage: String? = null
    }

    data class ToggleSystemSetting(
        val setting: SupportedSetting,
        val enabled: Boolean
    ) : AgentAction {
        override val targetPackage: String? = null
    }

    data class InspectUserSelectedFile(
        val uri: String
    ) : AgentAction {
        override val targetPackage: String? = null
    }

    enum class Direction { UP, DOWN, LEFT, RIGHT }
    enum class NavigationDestination { BACK, HOME, NOTIFICATIONS, RECENTS }
    enum class SupportedSetting { WIFI_PANEL, BLUETOOTH_PANEL, LOCATION_SETTINGS, DISPLAY_SETTINGS, SOUND_SETTINGS, BATTERY_SAVER_SETTINGS, NOTIFICATION_SETTINGS, APPLICATION_SETTINGS }
}
