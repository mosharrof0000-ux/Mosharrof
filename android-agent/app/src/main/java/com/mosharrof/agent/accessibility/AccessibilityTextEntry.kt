package com.mosharrof.agent.accessibility

import android.accessibilityservice.AccessibilityService
import android.os.Bundle
import android.view.accessibility.AccessibilityNodeInfo

/** Sets text only in a focused editable field of the explicitly selected target app. */
internal object AccessibilityTextEntry {
    private data class Pending(val packageName: String, val text: String, var remaining: Int = 20)
    private var pending: Pending? = null
    private var result: String? = null

    @Synchronized
    fun arm(service: AccessibilityService?, packageName: String, text: String): Boolean {
        if (service == null || packageName.isBlank() || text.isBlank() || text.length > 160 || pending != null) return false
        pending = Pending(packageName, text)
        result = null
        return true
    }

    @Synchronized
    fun onWindowEvent(service: AccessibilityService, packageName: String) {
        val task = pending ?: return
        if (packageName != task.packageName) return
        val root = service.rootInActiveWindow
        if (root == null) {
            expire(task, "লক্ষ্য অ্যাপের স্ক্রিন পাওয়া যায়নি; লেখা প্রবেশ করানো হয়নি।")
            return
        }
        try {
            if (root.packageName?.toString() != task.packageName) return
            val field = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
            if (field == null) {
                expire(task, "কোনো ফোকাস করা ইনপুট ক্ষেত্র পাওয়া যায়নি।")
                return
            }
            try {
                if (!field.isEditable || field.packageName?.toString() != task.packageName) {
                    expire(task, "ফোকাস করা control সম্পাদনযোগ্য নয়; লেখা প্রবেশ করানো হয়নি।")
                    return
                }
                val args = Bundle().apply {
                    putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, task.text)
                }
                if (field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) {
                    result = "নির্বাচিত অ্যাপের ফোকাস করা ইনপুট ক্ষেত্রে লেখা বসানো হয়েছে; পাঠানো হয়নি।"
                    pending = null
                } else {
                    expire(task, "Android ইনপুট ক্ষেত্রের লেখা পরিবর্তন গ্রহণ করেনি।")
                }
            } finally {
                field.recycle()
            }
        } finally {
            root.recycle()
        }
    }

    @Synchronized
    private fun expire(task: Pending, message: String) {
        task.remaining--
        if (task.remaining <= 0 || message.contains("ফোকাস করা control") || message.contains("সম্পাদনযোগ্য")) {
            result = message
            pending = null
        }
    }

    @Synchronized fun cancel() { pending = null }
    @Synchronized fun takeResult(): String? = result.also { result = null }
}
