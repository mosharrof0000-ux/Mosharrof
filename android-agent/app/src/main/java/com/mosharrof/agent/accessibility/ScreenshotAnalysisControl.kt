package com.mosharrof.agent.accessibility

import android.app.Activity
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/** User-triggered screenshot preview with transient, on-device visible-label analysis. */
object ScreenshotAnalysisControl {
    fun addTo(activity: Activity, layout: LinearLayout, status: TextView, isServiceEnabled: () -> Boolean) {
        val preview = ImageView(activity).apply {
            adjustViewBounds = true
            contentDescription = "Captured Android screen preview"
            visibility = ImageView.GONE
        }
        val analysis = TextView(activity).apply { textSize = 14f }
        layout.addView(Button(activity).apply {
            text = "স্ক্রিনশট নিন ও স্ক্রিন বিশ্লেষণ করুন"
            setOnClickListener {
                if (!isServiceEnabled()) {
                    status.text = "স্ক্রিনশটের জন্য আগে Accessibility service চালু করুন।"
                    return@setOnClickListener
                }
                isEnabled = false
                status.text = "Android-এর screenshot API থেকে ছবি নেওয়া হচ্ছে…"
                AccessibilityScreenshotCapture.capture { bitmap, error ->
                    isEnabled = true
                    if (bitmap == null) {
                        status.text = error ?: "স্ক্রিনশট নেওয়া যায়নি।"
                        analysis.text = ""
                        return@capture
                    }
                    preview.setImageBitmap(bitmap)
                    preview.visibility = ImageView.VISIBLE
                    val snapshot = MosharrofAccessibilityService.inspectCurrentScreenNow()
                    val labels = snapshot?.visibleLabels.orEmpty()
                    analysis.text = buildString {
                        appendLine("প্রাথমিক স্ক্রিন বিশ্লেষণ")
                        appendLine("ছবি: ${bitmap.width} × ${bitmap.height} পিক্সেল")
                        appendLine("প্যাকেজ: ${snapshot?.packageName ?: "পাওয়া যায়নি"}")
                        appendLine("UI node: ${snapshot?.nodeCount ?: 0}")
                        appendLine("পড়া যায় এমন লেবেল: ${labels.size}")
                        labels.take(20).forEach { appendLine("• $it") }
                        append("এটি ডিভাইসের UI-লেবেলভিত্তিক বিশ্লেষণ; AI vision ব্যাখ্যা এখনো সংযুক্ত নয়। ছবি স্বয়ংক্রিয়ভাবে সংরক্ষণ বা আপলোড করা হয় না।")
                    }
                    status.text = "স্ক্রিনশট নেওয়া হয়েছে; প্রাথমিক বিশ্লেষণ নিচে দেখানো হয়েছে।"
                }
            }
        })
        layout.addView(preview, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        layout.addView(analysis)
    }
}
