package com.mosharrof.agent.accessibility

import android.accessibilityservice.AccessibilityService
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

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
        @Volatile private var latestActionResult: String? = null

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
        }

        fun takeActionResult(): String? = latestActionResult.also { latestActionResult = null }
        fun isInspectionArmed(): Boolean = scanArmed
        fun hasInspectionSnapshot(): Boolean = latestSnapshot != null
    }
}
