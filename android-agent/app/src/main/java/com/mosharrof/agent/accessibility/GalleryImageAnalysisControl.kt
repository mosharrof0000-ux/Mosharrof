package com.mosharrof.agent.accessibility

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.mosharrof.agent.vision.VisionAnalysisClient

/** User-selected gallery image analysis; the image is sent only after a separate confirmation. */
object GalleryImageAnalysisControl {
    fun addTo(activity: Activity, layout: LinearLayout, status: TextView, pickImage: () -> Unit) {
        layout.addView(Button(activity).apply {
            text = "গ্যালারির ছবি বিশ্লেষণ করুন"
            setOnClickListener { pickImage() }
        })
    }

    fun analyzeSelected(activity: Activity, uri: Uri?, status: TextView) {
        if (uri == null) {
            status.text = "ছবি নির্বাচন বাতিল হয়েছে; কিছু আপলোড করা হয়নি।"
            return
        }
        val name = runCatching {
            activity.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else null
            }
        }.getOrNull().orEmpty().ifBlank { "নির্বাচিত ছবি" }
        if (!(activity.contentResolver.getType(uri) ?: "").startsWith("image/") &&
            name.substringAfterLast('.', "").lowercase() !in setOf("jpg", "jpeg", "png", "webp", "heic", "heif", "gif", "bmp")
        ) {
            status.text = "এটি ছবি বলে শনাক্ত করা যায়নি; কোনো তথ্য পাঠানো হয়নি।"
            return
        }
        AlertDialog.Builder(activity)
            .setTitle("ছবিটি AI-তে বিশ্লেষণ করবেন?")
            .setMessage("ছবি: $name\n\nসম্মতি দিলে ছবিটি Google Gemini Vision-এ HTTPS দিয়ে পাঠানো হবে। স্ক্রিনে ব্যক্তিগত বার্তা, পাসওয়ার্ড, OTP বা আর্থিক তথ্য থাকলে আগে তা বাদ দিন।")
            .setNegativeButton("বাতিল", null)
            .setPositiveButton("সম্মতি দিয়ে বিশ্লেষণ") { _, _ ->
                status.text = "ছবি প্রস্তুত করা হচ্ছে…"
                Thread {
                    val bitmap = runCatching { decodeBounded(activity, uri) }.getOrNull()
                    activity.runOnUiThread {
                        if (activity.isFinishing) {
                            bitmap?.recycle()
                            return@runOnUiThread
                        }
                        if (bitmap == null) {
                            status.text = "ছবি খোলা যায়নি বা ফাইলটি সমর্থিত নয়।"
                            return@runOnUiThread
                        }
                        status.text = "AI Vision ছবিটি বিশ্লেষণ করছে…"
                        VisionAnalysisClient.analyze(activity, bitmap) { result, error ->
                            activity.runOnUiThread {
                                if (!activity.isFinishing) {
                                    status.text = if (result == null) {
                                        "ছবি বিশ্লেষণ ব্যর্থ: ${error ?: "অজানা সমস্যা"}"
                                    } else {
                                        "ছবি বিশ্লেষণ সম্পন্ন • ${result.provider} / ${result.model}\n${result.text}\n\nবিশ্লেষণ মানে কোনো ফোনের কাজ সম্পন্ন হওয়া নয়।"
                                    }
                                }
                                bitmap.recycle()
                            }
                        }
                    }
                }.start()
            }
            .show()
    }

    private fun decodeBounded(activity: Activity, uri: Uri): Bitmap? {
        val resolver = activity.contentResolver
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) } ?: return null
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (bounds.outWidth / sample > 2048 || bounds.outHeight / sample > 2048) sample *= 2
        val options = BitmapFactory.Options().apply { inSampleSize = sample; inPreferredConfig = Bitmap.Config.ARGB_8888 }
        return resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
    }
}
