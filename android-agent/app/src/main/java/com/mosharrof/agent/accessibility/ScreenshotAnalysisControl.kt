package com.mosharrof.agent.accessibility

import android.app.Activity
import android.graphics.Bitmap
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/** User-armed screenshot capture, local label inspection, and explicitly opted-in AI vision. */
object ScreenshotAnalysisControl {
    private var previewView: ImageView? = null
    private var analysisView: TextView? = null
    private var statusView: TextView? = null
    private var capturedBitmap: Bitmap? = null

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
            text = "পরবর্তী অ্যাপের স্ক্রিনশট নিন"
            setOnClickListener {
                if (!isServiceEnabled()) {
                    status.text = "স্ক্রিনশটের জন্য আগে Accessibility service চালু করুন।"
                    return@setOnClickListener
                }
                capturedBitmap = null
                preview.setImageDrawable(null)
                preview.visibility = ImageView.GONE
                analysis.text = ""
                if (!MosharrofAccessibilityService.armScreenshotCapture()) {
                    status.text = "Accessibility service প্রস্তুত নয়; স্ক্রিনশট আর্ম করা যায়নি।"
                } else {
                    status.text = "এখন যে অ্যাপ বিশ্লেষণ করতে চান সেটি খুলুন। একটি স্ক্রিনশট নেওয়া হবে; তারপর MOSHARROF-এ ফিরে আসুন।"
                }
            }
        })
        layout.addView(Button(activity).apply {
            text = "AI দিয়ে স্ক্রিন বিশ্লেষণ করুন"
            setOnClickListener {
                val bitmap = capturedBitmap
                if (bitmap == null) {
                    status.text = "আগে স্ক্রিনশট নিন।"
                    return@setOnClickListener
                }
                isEnabled = false
                status.text = "স্ক্রিনশট MOSHARROF AI vision সার্ভারে পাঠানো হচ্ছে। ছবিতে ব্যক্তিগত তথ্য থাকতে পারে—শুধু আপনার অনুমতিতেই পাঠানো হবে।"
                ScreenshotVisionClient.analyze(bitmap) { result ->
                    isEnabled = true
                    analysis.text = result.message
                    status.text = if (result.ok) "AI vision বিশ্লেষণ সম্পন্ন।" else "AI vision বিশ্লেষণ ব্যর্থ; নিচে কারণ দেখুন।"
                }
            }
        })
        layout.addView(preview, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        layout.addView(analysis)
    }

    fun displayCapturedScreenshot(bitmap: Bitmap?, error: String?, packageName: String) {
        val status = statusView ?: return
        val preview = previewView ?: return
        val analysis = analysisView ?: return
        if (bitmap == null) {
            status.text = error ?: "স্ক্রিনশট নেওয়া যায়নি।"
            return
        }
        capturedBitmap?.takeIf { it !== bitmap }?.recycle()
        capturedBitmap = bitmap
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
            append("পূর্ণ AI vision পেতে ‘AI দিয়ে স্ক্রিন বিশ্লেষণ করুন’ চাপুন। এতে ছবিটি সার্ভারে পাঠানো হবে।")
        }
        status.text = "স্ক্রিনশট নেওয়া হয়েছে; AI বিশ্লেষণ ঐচ্ছিক—আপনি চাইলে বোতাম চাপুন।"
    }
}
