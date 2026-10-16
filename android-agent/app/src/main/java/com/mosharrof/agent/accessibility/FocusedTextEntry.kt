package com.mosharrof.agent.accessibility

import android.accessibilityservice.AccessibilityService

/** One-shot user-approved text insertion into the next focused editable field. */
internal object FocusedTextEntry {
    private var pendingText: String? = null

    @Synchronized fun arm(text: String): Boolean {
        if (text.isBlank() || text.length > 200 || pendingText != null) return false
        pendingText = text
        return true
    }

    @Synchronized fun cancel() { pendingText = null }

    @Synchronized fun onWindowChanged(
        service: AccessibilityService,
        eventPackage: String,
        ownPackage: String
    ): String? {
        val text = pendingText ?: return null
        if (eventPackage.isBlank() || eventPackage == ownPackage) return null
        val root = service.rootInActiveWindow ?: return null
        return try {
            if (root.packageName?.toString() != eventPackage) return null
            pendingText = null
            if (AccessibilityScreenInspector.setTextInFocusedField(root, text)) {
                "নির্বাচিত অ্যাপের focused text field-এ লেখা বসানো হয়েছে; কোনো send/submit বোতাম চাপা হয়নি।"
            } else {
                "লেখা বসানো যায়নি: লক্ষ্য অ্যাপে editable focused field পাওয়া যায়নি। আবার চেষ্টা করতে কমান্ড দিন।"
            }
        } finally {
            AccessibilityScreenInspector.recycle(root)
        }
    }
}
