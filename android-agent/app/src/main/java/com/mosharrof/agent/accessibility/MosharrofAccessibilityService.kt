package com.mosharrof.agent.accessibility

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.util.Log

/**
 * Read-only UI inspection foundation.
 *
 * This service deliberately does not auto-click arbitrary controls. A future action
 * executor must validate an explicit user task, target package, risk level, and
 * confirmation requirement before invoking performAction()/dispatchGesture().
 */
class MosharrofAccessibilityService : AccessibilityService() {
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val root = rootInActiveWindow ?: return
        try {
            val snapshot = buildString {
                append("package=").append(event.packageName ?: "unknown")
                append(" event=").append(event.eventType)
                append(" nodes=").append(countNodes(root, MAX_NODES))
            }
            Log.d(TAG, snapshot)
        } finally {
            root.recycleCompat()
        }
    }

    override fun onInterrupt() {
        Log.i(TAG, "Accessibility service interrupted by system")
    }

    private fun countNodes(node: AccessibilityNodeInfo, budget: Int): Int {
        var count = 1
        if (budget <= 1) return count
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
    private fun AccessibilityNodeInfo.recycleCompat() {
        // recycle() is deprecated on newer Android releases; retained for older API compatibility.
        recycle()
    }

    companion object {
        private const val TAG = "MosharrofAgent"
        private const val MAX_NODES = 500
    }
}
