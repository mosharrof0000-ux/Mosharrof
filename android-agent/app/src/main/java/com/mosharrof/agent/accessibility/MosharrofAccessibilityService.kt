package com.mosharrof.agent.accessibility

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.util.Log

data class ScreenSnapshot(
    val packageName: String,
    val nodeCount: Int,
    val visibleLabels: List<String>
)

/** Read-only accessibility inspection; screen text is returned only on explicit request. */
class MosharrofAccessibilityService : AccessibilityService() {
    override fun onServiceConnected() {
        super.onServiceConnected()
        activeService = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val root = rootInActiveWindow ?: return
        try {
            Log.d(TAG, "package=${event.packageName ?: "unknown"} event=${event.eventType} nodes=${countNodes(root, MAX_NODES)}")
        } finally {
            root.recycleCompat()
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
            ScreenSnapshot(root.packageName?.toString().orEmpty(), count, labels.distinct().take(MAX_LABELS))
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

    private fun countNodes(node: AccessibilityNodeInfo, budget: Int): Int {
        if (budget <= 1) return 1
        var count = 1
        for (index in 0 until node.childCount) {
            if (count >= budget) break
            val child = node.getChild(index) ?: continue
            try {
                count += countNodes(child, budget - count)
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

        fun inspectActiveWindow(): ScreenSnapshot? = activeService?.inspectWindow()
    }
}
