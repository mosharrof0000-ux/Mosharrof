package com.mosharrof.agent.accessibility

import android.accessibilityservice.AccessibilityService
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityNodeInfo

/** Sets text only in a focused editable field of the explicitly selected target app. */
internal object AccessibilityTextEntry {
    private data class Pending(val packageName: String, val text: String, var remaining: Int = 20)
    private var pending: Pending? = null
    private var result: String? = null
    private val handler = Handler(Looper.getMainLooper())

    @Synchronized
    fun arm(service: AccessibilityService?, packageName: String, text: String): Boolean {
        if (service == null || packageName.isBlank() || text.isBlank() || text.length > 160 || pending != null) return false
        pending = Pending(packageName, text)
        result = null
        handler.postDelayed({
            synchronized(this) {
                if (pending != null) {
                    result = "৩০ সেকেন্ডে কোনো ফোকাস করা ইনপুট ক্ষেত্র পাওয়া যায়নি; লেখা প্রবেশ করানো হয়নি।"
                    pending = null
                }
            }
        }, 30_000L)
        return true
    }

    @Synchronized
    fun onWindowEvent(service: AccessibilityService, packageName: String) {
        val task = pending ?: return
        if (packageName != task.packageName) return
        val root = service.rootInActiveWindow
        if (root == null) return
        try {
            if (root.packageName?.toString() != task.packageName) return
            val field = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
            if (field == null) return
            try {
                if (!field.isEditable || field.packageName?.toString() != task.packageName) {
                    result = "ফোকাস করা control সম্পাদনযোগ্য নয়; লেখা প্রবেশ করানো হয়নি."
                    pending = null
                    return
                }
                val args = Bundle().apply {
                    putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, task.text)
                }
                if (field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) {
                    result = "নির্বাচিত অ্যাপের ফোকাস করা ইনপুট ক্ষেত্রে লেখা বসানো হয়েছে; পাঠানো হয়নি।"
                    pending = null
                } else {
                    result = "Android ইনপুট ক্ষেত্রের লেখা পরিবর্তন গ্রহণ করেনি।"
                    pending = null
                }
            } finally {
                field.recycle()
            }
        } finally {
            root.recycle()
        }
    }

    @Synchronized fun cancel() { pending = null }
    @Synchronized fun takeResult(): String? = result.also { result = null }
}
