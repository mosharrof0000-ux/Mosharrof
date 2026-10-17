package com.mosharrof.agent.accessibility

import android.os.Bundle
import android.view.accessibility.AccessibilityNodeInfo

data class ScreenSnapshot(
    val packageName: String,
    val nodeCount: Int,
    val visibleLabels: List<String>
)

internal enum class ExactTapResult { NO_MATCH, CLICKED, NOT_CLICKABLE, AMBIGUOUS }

private class NodeBudget(var remaining: Int)

/** Bounded traversal helper; only reads visible labels or taps one unique exact match. */
internal object AccessibilityScreenInspector {
    private const val MAX_NODES = 500
    private const val MAX_LABELS = 40
    private const val MAX_LABEL_LENGTH = 80
    private const val MAX_CLICKABLE_ANCESTORS = 5

    fun inspect(root: AccessibilityNodeInfo): ScreenSnapshot {
        val labels = mutableListOf<String>()
        val count = collectLabels(root, labels, MAX_NODES)
        return ScreenSnapshot(
            root.packageName?.toString().orEmpty(),
            count,
            labels.distinct().take(MAX_LABELS)
        )
    }

    fun setTextInFocusedField(root: AccessibilityNodeInfo, text: String): Boolean {
        if (text.isBlank() || text.length > 200) return false
        return setFocusedText(root, text, NodeBudget(MAX_NODES))
    }

    private fun setFocusedText(node: AccessibilityNodeInfo, text: String, budget: NodeBudget): Boolean {
        if (budget.remaining-- <= 0) return false
        if (node.isFocused && node.isEditable) {
            return node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply {
                putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
            })
        }
        for (index in 0 until node.childCount) {
            if (budget.remaining <= 0) break
            val child = node.getChild(index) ?: continue
            try { if (setFocusedText(child, text, budget)) return true }
            finally { recycle(child) }
        }
        return false
    }

    fun tapExact(root: AccessibilityNodeInfo, target: String): ExactTapResult =
        when (countMatches(root, target, NodeBudget(MAX_NODES))) {
            0 -> ExactTapResult.NO_MATCH
            1 -> if (clickMatchingNode(root, target, NodeBudget(MAX_NODES))) {
                ExactTapResult.CLICKED
            } else {
                ExactTapResult.NOT_CLICKABLE
            }
            else -> ExactTapResult.AMBIGUOUS
        }

    @Suppress("DEPRECATION")
    fun recycle(node: AccessibilityNodeInfo) = node.recycle()

    private fun countMatches(node: AccessibilityNodeInfo, target: String, budget: NodeBudget): Int {
        if (budget.remaining <= 0) return 0
        budget.remaining -= 1
        var count = if (matchesTarget(node, target)) 1 else 0
        for (index in 0 until node.childCount) {
            if (count > 1 || budget.remaining <= 0) break
            val child = node.getChild(index) ?: continue
            try {
                count += countMatches(child, target, budget)
            } finally {
                recycle(child)
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
                recycle(child)
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
                recycle(parent)
                return clicked
            }
            val next = parent.parent
            recycle(parent)
            parent = next
        }
        parent?.let(::recycle)
        return false
    }

    private fun matchesTarget(node: AccessibilityNodeInfo, target: String): Boolean {
        val expected = target.trim()
        return node.text?.toString()?.trim()?.equals(expected, ignoreCase = true) == true ||
            node.contentDescription?.toString()?.trim()?.equals(expected, ignoreCase = true) == true
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
                recycle(child)
            }
        }
        return count
    }
}
