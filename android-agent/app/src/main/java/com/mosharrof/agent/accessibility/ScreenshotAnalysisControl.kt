package com.mosharrof.agent.accessibility

import android.app.Activity
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/** User-armed screenshot capture for the next app, with transient local label analysis. */
object ScreenshotAnalysisControl {
    private var previewView: ImageView? = null
    private var analysisView: TextView? = null
    private var statusView: TextView? = null

    fun addTo(activity: Activity, layout: LinearLayout, status: TextView, isServiceEnabled: () -> Boolean) {
        val preview = ImageView(activity).apply {
            adjustViewBounds = true
            contentDescription = "Captured Android screen preview"
            visibility = ImageView.GONE
        }
        val analysis = TextView(activity).apply { textSize = 14f }
        previewView = preview
        analysisView = analysis
        statusView = status
        layout.addView(Button(activity).apply {
            text = "পরবর্তী অ্যাপের স্ক্রিনশট নিন ও বিশ্লেষণ করুন"
            setOnClickListener {
                if (!isServiceEnabled()) {
                    status.text = "স্ক্রিনশটের জন্য আগে Accessibility service চালু করুন।"
                    return@setOnClickListener
                }
                preview.setImageDrawable(null)
                preview.visibility = ImageView.GONE
                analysis.text = ""
                if (!MosharrofAccessibilityService.armScreenshotCapture()) {
                    status.text = "Accessibility service প্রস্তুত নয়; স্ক্রিনশট আর্ম করা যায়নি।"
                } else {
                    status.text = "এখন যে অ্যাপ বিশ্লেষণ করতে চান সেটি খুলুন। পরের অ্যাপ-স্ক্রিনের একটি ছবি নেওয়া হবে; তারপর MOSHARROF-এ ফিরে আসুন।"
                }
            }
        })
        layout.addView(preview, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        layout.addView(analysis)
    }

    fun displayCapturedScreenshot(bitmap: android.graphics.Bitmap?, error: String?, packageName: String) {
        val status = statusView ?: return
        val preview = previewView ?: return
        val analysis = analysisView ?: return
        if (bitmap == null) {
            status.text = error ?: "স্ক্রিনশট নেওয়া যায়নি।"
            return
        }
        preview.setImageBitmap(bitmap)
        preview.visibility = ImageView.VISIBLE
        val snapshot = MosharrofAccessibilityService.inspectCurrentScreenNow()
        val labels = snapshot?.visibleLabels.orEmpty()
        analysis.text = buildString {
            appendLine("প্রাথমিক স্ক্রিন বিশ্লেষণ")
            appendLine("লক্ষ্য অ্যাপ: $packageName")
            appendLine("ছবি: ${bitmap.width} × ${bitmap.height} পিক্সেল")
            appendLine("UI node: ${snapshot?.nodeCount ?: 0}")
            appendLine("পড়া যায় এমন লেবেল: ${labels.size}")
            labels.take(20).forEach { appendLine("• $it") }
            append("এটি UI-লেবেলভিত্তিক প্রাথমিক বিশ্লেষণ; AI vision ব্যাখ্যা এখনো সংযুক্ত নয়। ছবি স্বয়ংক্রিয়ভাবে সংরক্ষণ বা আপলোড করা হয় না।")
        }
        status.text = "স্ক্রিনশট নেওয়া হয়েছে; MOSHARROF-এ ফিরে এসে নিচের বিশ্লেষণ দেখুন।"
    }
}
