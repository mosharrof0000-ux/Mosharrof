package com.mosharrof.agent.accessibility

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Bitmap
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/** User-armed screenshot capture, local preview and explicitly approved remote AI analysis. */
object ScreenshotAnalysisControl {
    private var hostActivity: Activity? = null
    private var previewView: ImageView? = null
    private var analysisView: TextView? = null
    private var statusView: TextView? = null
    private var analyzeButton: Button? = null
    private var capturedBitmap: Bitmap? = null

    fun addTo(activity: Activity, layout: LinearLayout, status: TextView, isServiceEnabled: () -> Boolean) {
        hostActivity = activity
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
                capturedBitmap?.recycle()
                capturedBitmap = null
                preview.visibility = ImageView.GONE
                analysis.text = ""
                analyzeButton?.isEnabled = false
                if (!MosharrofAccessibilityService.armScreenshotCapture()) {
                    status.text = "Accessibility service প্রস্তুত নয়; স্ক্রিনশট আর্ম করা যায়নি।"
                } else {
                    status.text = "এখন যে অ্যাপ বিশ্লেষণ করতে চান সেটি খুলুন। পরের অ্যাপ-স্ক্রিনের একটি ছবি নেওয়া হবে; তারপর MOSHARROF-এ ফিরে আসুন।"
                }
            }
        })
        val analyze = Button(activity).apply {
            text = "AI Vision দিয়ে বুদ্ধিমত্তার সঙ্গে বিশ্লেষণ করুন"
            isEnabled = false
            setOnClickListener { requestRemoteAnalysis() }
        }
        analyzeButton = analyze
        layout.addView(analyze)
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
        capturedBitmap = bitmap
        preview.setImageBitmap(bitmap)
        preview.visibility = ImageView.VISIBLE
        analyzeButton?.isEnabled = true
        val snapshot = MosharrofAccessibilityService.inspectCurrentScreenNow()
        val labels = snapshot?.visibleLabels.orEmpty()
        analysis.text = buildString {
            appendLine("প্রাথমিক স্ক্রিন বিশ্লেষণ")
            appendLine("লক্ষ্য অ্যাপ: $packageName")
            appendLine("ছবি: ${bitmap.width} × ${bitmap.height} পিক্সেল")
            appendLine("UI node: ${snapshot?.nodeCount ?: 0}")
            appendLine("পড়া যায় এমন লেবেল: ${labels.size}")
            labels.take(20).forEach { appendLine("• $it") }
            append("এটি UI-লেবেলভিত্তিক প্রাথমিক বিশ্লেষণ। চাইলে নিচের AI Vision বোতাম থেকে ছবি Worker-এ পাঠিয়ে বিশ্লেষণ করান।")
        }
        status.text = "স্ক্রিনশট নেওয়া হয়েছে। স্থানীয় তথ্য দেখুন অথবা অনুমতি দিয়ে AI Vision চালান।"
    }

    private fun requestRemoteAnalysis() {
        val activity = hostActivity ?: return
        val bitmap = capturedBitmap ?: run {
            statusView?.text = "আগে একটি স্ক্রিনশট নিন।"
            return
        }
        AlertDialog.Builder(activity)
            .setTitle("স্ক্রিনশট AI-তে পাঠাবেন?")
            .setMessage("ছবিটি MOSHARROF-এর বিদ্যমান HTTPS chat Worker-এ পাঠানো হবে, যাতে সংযুক্ত AI ইঞ্জিন স্ক্রিন বুঝতে পারে। ছবিটি এই ফিচার থেকে ডিভাইসে সংরক্ষণ করা হয় না। সংবেদনশীল তথ্য থাকলে আগে স্ক্রিনটি বন্ধ করুন বা বাতিল করুন।")
            .setNegativeButton("বাতিল", null)
            .setPositiveButton("পাঠিয়ে বিশ্লেষণ করুন") { _, _ ->
                analyzeButton?.isEnabled = false
                statusView?.text = "AI Vision বিশ্লেষণ চলছে…"
                VisionAnalysisClient.analyze(bitmap) { result, error ->
                    activity.runOnUiThread {
                        if (activity.isFinishing || hostActivity !== activity) return@runOnUiThread
                        analyzeButton?.isEnabled = capturedBitmap != null
                        if (result == null) {
                            statusView?.text = error ?: "AI Vision বিশ্লেষণ ব্যর্থ হয়েছে।"
                            return@runOnUiThread
                        }
                        val analysis = analysisView ?: return@runOnUiThread
                        analysis.append("\n\nAI Vision ফলাফল")
                        if (!result.provider.isNullOrBlank()) analysis.append("\nইঞ্জিন: ${result.provider}${result.model?.let { " • $it" } ?: ""}")
                        analysis.append("\n${result.text}")
                        statusView?.text = "AI Vision বিশ্লেষণ সম্পন্ন হয়েছে। কাজের পরবর্তী ধাপের আগে ফল যাচাই করুন।"
                    }
                }
            }
            .show()
    }
}
