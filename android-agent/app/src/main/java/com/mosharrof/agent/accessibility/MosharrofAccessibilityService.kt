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

/** Bounded screen inspection runs only during an explicitly armed user scan. */
class MosharrofAccessibilityService : AccessibilityService() {
    override fun onServiceConnected() {
        super.onServiceConnected()
        activeService = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null || !scanArmed) return
        if (event.packageName?.toString() == packageName) return
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
        @Volatile private var activeService: MosharrofAccessibilityService? = null
        @Volatile private var scanArmed = false
        @Volatile private var latestSnapshot: ScreenSnapshot? = null

        fun startInspection() {
            latestSnapshot = null
            scanArmed = true
        }

        fun takeInspectionSnapshot(): ScreenSnapshot? {
            scanArmed = false
            return latestSnapshot.also { latestSnapshot = null }
        }

        fun isInspectionArmed(): Boolean = scanArmed
        fun hasInspectionSnapshot(): Boolean = latestSnapshot != null
    }
}
