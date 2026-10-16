package com.mosharrof.agent.accessibility

import android.accessibilityservice.AccessibilityService

/** Inserts user-approved text only into the focused editable field of the named app. */
internal object FocusedTextEntry {
    private data class Pending(val packageName: String, val text: String, var remaining: Int = 40)
    private var pending: Pending? = null

    @Synchronized
    fun arm(packageName: String, text: String): Boolean {
        if (packageName.isBlank() || text.isBlank() || text.length > 160 || pending != null) return false
        pending = Pending(packageName, text)
        return true
    }

    @Synchronized fun cancel() { pending = null }

    @Synchronized
    fun onWindowChanged(service: AccessibilityService, eventPackage: String, ownPackage: String): String? {
        val task = pending ?: return null
        if (eventPackage != task.packageName || eventPackage == ownPackage) return null
        val root = service.rootInActiveWindow ?: return expireOrWait(task)
        return try {
            if (root.packageName?.toString() != task.packageName) return null
            val inserted = AccessibilityScreenInspector.setTextInFocusedField(root, task.text)
            if (inserted) {
                pending = null
                "নির্বাচিত অ্যাপের focused text field-এ লেখা বসানো হয়েছে; কোনো send/submit বোতাম চাপা হয়নি।"
            } else {
                expireOrWait(task)
            }
        } finally {
            AccessibilityScreenInspector.recycle(root)
        }
    }

    private fun expireOrWait(task: Pending): String? {
        task.remaining--
        if (task.remaining > 0) return null
        pending = null
        return "লক্ষ্য অ্যাপে ফোকাস করা editable field পাওয়া যায়নি; লেখা প্রবেশ করানো হয়নি। আবার চেষ্টা করতে কমান্ড দিন।"
    }
}
