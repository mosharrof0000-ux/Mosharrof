package com.mosharrof.agent.files

import android.app.Activity
import android.app.AlertDialog
import android.net.Uri
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.mosharrof.agent.vision.AudioAnalysisClient

/** Presents the selected filename and explicit upload consent before sending audio to Gemini. */
object AudioAnalysisControl {
    fun addTo(activity: Activity, layout: LinearLayout, status: TextView, pickAudio: () -> Unit) {
        layout.addView(Button(activity).apply {
            text = "গান বিশ্লেষণ ও বাংলা শিরোনাম লিখুন"
            setOnClickListener { pickAudio() }
        })
    }

    fun analyzeSelected(activity: Activity, uri: Uri?, status: TextView) {
        if (uri == null) {
            status.text = "গান নির্বাচন বাতিল হয়েছে; কোনো অডিও পাঠানো হয়নি।"
            return
        }
        val name = runCatching {
            activity.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else null
            }
        }.getOrNull().orEmpty().ifBlank { "নির্বাচিত অডিও" }
        val mime = activity.contentResolver.getType(uri) ?: ""
        if (!mime.startsWith("audio/") &&
            name.substringAfterLast('.', "").lowercase() !in setOf("mp3", "m4a", "aac", "wav", "ogg", "flac", "opus", "wma")
        ) {
            status.text = "এটি অডিও ফাইল বলে শনাক্ত করা যায়নি; কোনো তথ্য পাঠানো হয়নি।"
            return
        }
        AlertDialog.Builder(activity)
            .setTitle("গানটি AI-তে বিশ্লেষণ করবেন?")
            .setMessage("ফাইল: $name\n\nআপনার নির্বাচিত অডিও Google Gemini-তে HTTPS দিয়ে পাঠানো হবে। বিশ্লেষণে বাংলা শিরোনাম, সম্ভাব্য বিষয় (একাধিক হতে পারে) এবং সংক্ষিপ্ত ব্যাখ্যা তৈরি হবে। গানের সম্পূর্ণ লিরিক্স সংরক্ষণ বা প্রকাশ করা হবে না। ব্যক্তিগত/সংবেদনশীল রেকর্ডিং হলে বাতিল করুন।")
            .setNegativeButton("বাতিল", null)
            .setPositiveButton("সম্মতি দিয়ে বিশ্লেষণ") { _, _ ->
                status.text = "গান বিশ্লেষণ চলছে; অডিওর আকার 20 MB-এর মধ্যে হতে হবে…"
                AudioAnalysisClient.analyzeSelected(activity, uri) { result, error ->
                    activity.runOnUiThread {
                        if (activity.isFinishing) return@runOnUiThread
                        if (result == null) {
                            status.text = "গান বিশ্লেষণ ব্যর্থ: ${error ?: "অজানা সমস্যা"}"
                        } else {
                            val topics = result.metadata.topics.joinToString("、") { it.bengaliLabel }
                            status.text = buildString {
                                appendLine("গান বিশ্লেষণ সম্পন্ন • ${result.provider} / ${result.model}")
                                appendLine("মূল ফাইল: ${result.originalName}")
                                appendLine("বাংলা শিরোনাম: ${result.metadata.bengaliTitle}")
                                appendLine("বিষয়: $topics")
                                appendLine("ব্যাখ্যা: ${result.metadata.summaryBengali}")
                                appendLine("অনিশ্চয়তা: ${result.metadata.uncertainty}")
                                append("এই metadata ডিভাইসে রাখা হয়েছে; ফাইলের নাম বদলায়নি।")
                            }
                        }
                    }
                }
            }
            .show()
    }
}
