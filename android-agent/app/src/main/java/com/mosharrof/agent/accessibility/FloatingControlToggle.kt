package com.mosharrof.agent.accessibility

import android.accessibilityservice.AccessibilityServiceInfo
import android.app.Activity
import android.content.Intent
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.getSystemService
import com.mosharrof.agent.execution.AccessibilityConsentDialog

/** User-visible toggle for the draggable floating voice control. */
object FloatingControlToggle {
    fun addTo(activity: Activity, layout: LinearLayout, status: TextView) {
        val button = Button(activity).apply {
            text = label(activity)
            setOnClickListener {
                val manager = activity.getSystemService<AccessibilityManager>()
                val enabled = manager?.getEnabledAccessibilityServiceList(
                    AccessibilityServiceInfo.FEEDBACK_ALL_MASK
                )?.any { it.resolveInfo.serviceInfo.packageName == activity.packageName } == true
                if (!enabled) {
                    AccessibilityConsentDialog.show(activity) {
                        activity.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                    }
                    status.text = "Accessibility চালু করার পর আবার ভাসমান সহকারী বোতামটি চাপুন।"
                    return@setOnClickListener
                }
                val next = !MosharrofAccessibilityService.isFloatingControlEnabled(activity)
                MosharrofAccessibilityService.setFloatingControlEnabled(activity, next)
                text = label(activity)
                status.text = if (next) {
                    "ভাসমান ভয়েস সহকারী চালু হয়েছে। যেকোনো স্ক্রিনে মাইক্রোফোন বোতাম ব্যবহার করুন; দীর্ঘক্ষণ চেপে ধরলে আকার বদলাবে।"
                } else {
                    "ভাসমান ভয়েস সহকারী বন্ধ হয়েছে।"
                }
            }
        }
        layout.addView(button)
    }

    private fun label(activity: Activity): String =
        if (MosharrofAccessibilityService.isFloatingControlEnabled(activity)) {
            "ভাসমান সহকারী বন্ধ করুন"
        } else {
            "ভাসমান সহকারী চালু করুন"
        }
}
