package com.mosharrof.agent.accessibility

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.mosharrof.agent.planner.AgentAction

data class ScreenSnapshot(
    val packageName: String,
    val nodeCount: Int,
    val visibleLabels: List<String>
)

private data class PendingSemanticTap(
    val targetPackage: String,
    val visibleText: String,
    var targetEventsRemaining: Int = 20
)

private data class PendingSwipe(val targetPackage: String, val direction: AgentAction.Direction, var targetEventsRemaining: Int = 20)

private class NodeBudget(var remaining: Int)

/** Bounded screen inspection and exact-label taps run only after explicit user action. */
class MosharrofAccessibilityService : AccessibilityService() {
    override fun onServiceConnected() {
        super.onServiceConnected()
        activeService = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val eventPackage = event.packageName?.toString().orEmpty()
        if (eventPackage == packageName) return

        pendingTap?.takeIf { it.targetPackage == eventPackage }?.let { processPendingTap(it) }
        pendingSwipe?.takeIf { it.targetPackage == eventPackage }?.let { processPendingSwipe(it) }
        if (!scanArmed) return

        val snapshot = inspectWindow() ?: return
        if (snapshot.packageName.isNotBlank() && snapshot.packageName != packageName) {
            latestSnapshot = snapshot
            Log.d(TAG, "User-armed scan captured package=" + snapshot.packageName +
                ", nodes=" + snapshot.nodeCount)
        }
    }

    override fun onInterrupt() {
        Log.i(TAG, "Accessibility service interrupted by system")
    }

    override fun onDestroy() {
        if (activeService === this) activeService = null
        super.onDestroy()
    }

    private fun processPendingSwipe(swipe: PendingSwipe) {
        val root = rootInActiveWindow
        if (root == null) {
            swipe.targetEventsRemaining -= 1
            if (swipe.targetEventsRemaining <= 0) finishSwipe("লক্ষ্য স্ক্রিন পাওয়া যায়নি; স্ক্রল করা হয়নি।")
            return
        }
        try {
            if (root.packageName?.toString() != swipe.targetPackage) return
            val metrics = resources.displayMetrics
            val width = metrics.widthPixels.toFloat()
            val height = metrics.heightPixels.toFloat()
            val startX: Float
            val startY: Float
            val endX: Float
            val endY: Float
            when (swipe.direction) {
                AgentAction.Direction.UP -> { startX = width * .5f; startY = height * .78f; endX = width * .5f; endY = height * .28f }
                AgentAction.Direction.DOWN -> { startX = width * .5f; startY = height * .28f; endX = width * .5f; endY = height * .78f }
                AgentAction.Direction.LEFT -> { startX = width * .78f; startY = height * .5f; endX = width * .22f; endY = height * .5f }
                AgentAction.Direction.RIGHT -> { startX = width * .22f; startY = height * .5f; endX = width * .78f; endY = height * .5f }
            }
            val path = Path().apply { moveTo(startX, startY); lineTo(endX, endY) }
            val gesture = GestureDescription.Builder()
                .addStroke(GestureDescription.StrokeDescription(path, 0, 350))
                .build()
            pendingSwipe = null
            val accepted = dispatchGesture(gesture, object : GestureResultCallback() {
                override fun onCompleted(description: GestureDescription?) {
                    latestActionResult = "স্ক্রল gesture সম্পন্ন হয়েছে।"
                }
                override fun onCancelled(description: GestureDescription?) {
                    latestActionResult = "Android gesture বাতিল করেছে; স্ক্রল সম্পন্ন হয়নি।"
                }
            }, null)
            if (!accepted) latestActionResult = "Android gesture গ্রহণ করেনি; স্ক্রল করা হয়নি।"
        } finally {
            root.recycleCompat()
        }
    }

    private fun finishSwipe(message: String) {
        latestActionResult = message
        pendingSwipe = null
    }

    private fun processPendingTap(tap: PendingSemanticTap) {
        val root = rootInActiveWindow
        if (root == null) {
            failAfterBudget(tap, "লক্ষ্য স্ক্রিন পাওয়া যায়নি; কোনো ট্যাপ করা হয়নি।")
            return
        }
        try {
            if (root.packageName?.toString() != tap.targetPackage) return
            when (countMatches(root, tap.visibleText, NodeBudget(MAX_NODES))) {
                0 -> failAfterBudget(tap, "লক্ষ্য লেবেল এখনো পাওয়া যায়নি।")
                1 -> {
                    val success = clickMatchingNode(root, tap.visibleText, NodeBudget(MAX_NODES))
                    finishTap(if (success) {
                        "নির্দিষ্ট UI লেবেলে একবার ট্যাপ করা হয়েছে।"
                    } else {
                        "লেবেল পাওয়া গেছে কিন্তু নিরাপদ clickable control মেলেনি; কোনো ট্যাপ করা হয়নি।"
                    })
                }
                else -> finishTap("একই লেবেল একাধিক জায়গায় আছে; অস্পষ্টতার কারণে ট্যাপ করা হয়নি।")
            }
        } finally {
            root.recycleCompat()
        }
    }

    private fun failAfterBudget(tap: PendingSemanticTap, message: String) {
        tap.targetEventsRemaining -= 1
        if (tap.targetEventsRemaining <= 0) finishTap(message)
    }

    private fun finishTap(message: String) {
        latestActionResult = message
        pendingTap = null
    }

    private fun countMatches(
        node: AccessibilityNodeInfo,
        target: String,
        budget: NodeBudget
    ): Int {
        if (budget.remaining <= 0) return 0
        budget.remaining -= 1
        var count = if (matchesTarget(node, target)) 1 else 0
        for (index in 0 until node.childCount) {
            if (count > 1 || budget.remaining <= 0) break
            val child = node.getChild(index) ?: continue
            try {
                count += countMatches(child, target, budget)
            } finally {
                child.recycleCompat()
            }
        }
        return count
    }

    private fun clickMatchingNode(
        node: AccessibilityNodeInfo,
        target: String,
        budget: NodeBudget
    ): Boolean {
        if (budget.remaining <= 0) return false
        budget.remaining -= 1
        if (matchesTarget(node, target)) return clickSelfOrClickableParent(node)
        for (index in 0 until node.childCount) {
            if (budget.remaining <= 0) break
            val child = node.getChild(index) ?: continue
            try {
                if (clickMatchingNode(child, target, budget)) return true
            } finally {
                child.recycleCompat()
            }
        }
        return false
    }

    private fun clickSelfOrClickableParent(node: AccessibilityNodeInfo): Boolean {
        if (node.isClickable) return node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        var parent = node.parent
        repeat(MAX_CLICKABLE_ANCESTORS) {
            if (parent == null) return false
            if (parent.isClickable) {
                val clicked = parent.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                parent.recycleCompat()
                return clicked
            }
            val next = parent.parent
            parent.recycleCompat()
            parent = next
        }
        parent?.recycleCompat()
        return false
    }

    private fun matchesTarget(node: AccessibilityNodeInfo, target: String): Boolean {
        val expected = target.trim()
        return node.text?.toString()?.trim()?.equals(expected, ignoreCase = true) == true ||
            node.contentDescription?.toString()?.trim()?.equals(expected, ignoreCase = true) == true
    }

    private fun inspectWindow(): ScreenSnapshot? {
        val root = rootInActiveWindow ?: return null
        return try {
            val labels = mutableListOf<String>()
            val count = collectLabels(root, labels, MAX_NODES)
            ScreenSnapshot(
                root.packageName?.toString().orEmpty(),
                count,
                labels.distinct().take(MAX_LABELS)
            )
        } finally {
            root.recycleCompat()
        }
    }

    private fun collectLabels(
        node: AccessibilityNodeInfo,
        labels: MutableList<String>,
        budget: Int
    ): Int {
        if (budget <= 0) return 0
        listOf(node.text, node.contentDescription).forEach { value ->
            value?.toString()?.trim()?.take(MAX_LABEL_LENGTH)?.takeIf { it.isNotBlank() }
                ?.let { if (labels.size < MAX_LABELS) labels.add(it) }
        }
        var count = 1
        for (index in 0 until node.childCount) {
            if (count >= budget) break
            val child = node.getChild(index) ?: continue
            try {
                count += collectLabels(child, labels, budget - count)
            } finally {
                child.recycleCompat()
            }
        }
        return count
    }

    @Suppress("DEPRECATION")
    private fun AccessibilityNodeInfo.recycleCompat() = recycle()

    companion object {
        private const val TAG = "MosharrofAgent"
        private const val MAX_NODES = 500
        private const val MAX_LABELS = 40
        private const val MAX_LABEL_LENGTH = 80
        private const val MAX_CLICKABLE_ANCESTORS = 5
        @Volatile private var activeService: MosharrofAccessibilityService? = null
        @Volatile private var scanArmed = false
        @Volatile private var latestSnapshot: ScreenSnapshot? = null
        @Volatile private var pendingTap: PendingSemanticTap? = null
        @Volatile private var pendingSwipe: PendingSwipe? = null
        @Volatile private var latestActionResult: String? = null

        fun performGlobalNavigation(destination: AgentAction.NavigationDestination): Boolean {
            val service = activeService ?: return false
            val action = when (destination) {
                AgentAction.NavigationDestination.BACK -> GLOBAL_ACTION_BACK
                AgentAction.NavigationDestination.HOME -> GLOBAL_ACTION_HOME
                AgentAction.NavigationDestination.NOTIFICATIONS -> GLOBAL_ACTION_NOTIFICATIONS
                AgentAction.NavigationDestination.RECENTS -> GLOBAL_ACTION_RECENTS
            }
            return service.performGlobalAction(action)
        }

        fun cancelInspection() {
            scanArmed = false
            latestSnapshot = null
        }

        fun startInspection() {
            latestSnapshot = null
            scanArmed = true
        }

        fun takeInspectionSnapshot(): ScreenSnapshot? {
            scanArmed = false
            return latestSnapshot.also { latestSnapshot = null }
        }

        fun armSemanticTap(targetPackage: String, visibleText: String): Boolean {
            if (activeService == null || targetPackage.isBlank() || visibleText.isBlank() ||
                visibleText.length > MAX_LABEL_LENGTH || pendingTap != null
            ) return false
            latestActionResult = null
            pendingTap = PendingSemanticTap(targetPackage, visibleText)
            return true
        }

        fun cancelSemanticTap() {
            pendingTap = null
            pendingSwipe = null
        }

        fun armSwipe(targetPackage: String, direction: AgentAction.Direction): Boolean {
            if (activeService == null || targetPackage.isBlank() || pendingTap != null || pendingSwipe != null) return false
            latestActionResult = null
            pendingSwipe = PendingSwipe(targetPackage, direction)
            return true
        }

        fun takeActionResult(): String? = latestActionResult.also { latestActionResult = null }
        fun isInspectionArmed(): Boolean = scanArmed
        fun hasInspectionSnapshot(): Boolean = latestSnapshot != null
    }
}
