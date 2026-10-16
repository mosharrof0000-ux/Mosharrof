package com.mosharrof.agent.accessibility

import android.os.Bundle
import android.view.accessibility.AccessibilityNodeInfo

internal enum class TextInputResult { NO_FIELD, AMBIGUOUS, SET_FAILED, SET }
private const val MAX_INPUT_NODES = 500

/** Changes text only in one unambiguous editable field; never clicks Send/Submit. */
internal object AccessibilityTextInput {
    fun setText(root: AccessibilityNodeInfo, value: String): TextInputResult {
        if (value.isBlank() || value.length > 160) return TextInputResult.SET_FAILED
        val fields = mutableListOf<AccessibilityNodeInfo>()
        collectEditable(root, fields, MAX_INPUT_NODES)
        try {
            if (fields.isEmpty()) return TextInputResult.NO_FIELD
            val focused = fields.filter { it.isFocused }
            val target = when {
                focused.size == 1 -> focused.single()
                focused.size > 1 -> return TextInputResult.AMBIGUOUS
                fields.size == 1 -> fields.single()
                else -> return TextInputResult.AMBIGUOUS
            }
            val args = Bundle().apply {
                putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value)
            }
            return if (target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) {
                TextInputResult.SET
            } else TextInputResult.SET_FAILED
        } finally {
            fields.forEach { AccessibilityScreenInspector.recycle(it) }
        }
    }

    private fun collectEditable(
        node: AccessibilityNodeInfo,
        output: MutableList<AccessibilityNodeInfo>,
        budget: Int
    ): Int {
        if (budget <= 0 || output.size >= 20) return 0
        var visited = 1
        if (node.isVisibleToUser && node.isEditable) {
            output.add(AccessibilityNodeInfo.obtain(node))
        }
        for (index in 0 until node.childCount) {
            if (visited >= budget || output.size >= 20) break
            val child = node.getChild(index) ?: continue
            try {
                visited += collectEditable(child, output, budget - visited)
            } finally {
                AccessibilityScreenInspector.recycle(child)
            }
        }
        return visited
    }
}
