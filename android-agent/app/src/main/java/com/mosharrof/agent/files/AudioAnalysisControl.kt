package com.mosharrof.agent.files

import android.app.Activity
import android.app.AlertDialog
import android.net.Uri
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.documentfile.provider.DocumentFile
import com.mosharrof.agent.vision.AudioAnalysisClient

/** Presents the selected filename and explicit upload consent before sending audio to Gemini. */
object AudioAnalysisControl {
    fun addTo(activity: Activity, layout: LinearLayout, status: TextView, pickAudio: () -> Unit) {
        layout.addView(Button(activity).apply {
            text = "গান বিশ্লেষণ ও বাংলা শিরোনাম লিখুন"
            setOnClickListener { pickAudio() }
        })
    }

    fun handleCommand(activity: Activity, rawCommand: String, status: TextView, pickAudio: () -> Unit): Boolean {
        val command = rawCommand.lowercase()
        val matches = listOf("গান বিশ্লেষণ", "গানগুলো বিশ্লেষণ", "গান এনালাইস", "গানগুলো এনালাইস", "গান অ্যানালাইস", "গানের বিষয়", "song analysis", "analyze song", "analyze audio", "analyze my songs", "বাংলা শিরোনাম", "ইংলিশ টাইটেল বাংলায়")
            .any { command.contains(it) }
        if (!matches) return false
        val saved = activity.getSharedPreferences("mosharrof_media_control", Activity.MODE_PRIVATE)
            .getString("selected_tree_uri", null)
        val root = saved?.let { runCatching { DocumentFile.fromTreeUri(activity, Uri.parse(it)) }.getOrNull() }
        if (root == null || !root.isDirectory) {
            status.text = "একটি গান বিশ্লেষণ করতে অডিও ফাইল বাছুন; একাধিক গানের জন্য আগে মিডিয়া ফোল্ডার নির্বাচন করুন।"
            pickAudio()
            return true
        }
        val candidates = mutableListOf<DocumentFile>()
        collectAudio(root, 0, candidates)
        val unreviewed = candidates.filter { SongMetadataStore.load(activity, it.uri.toString()) == null }
            .filter { it.length() in 1..(20L * 1024L * 1024L) }
            .sortedBy { it.name.orEmpty() }
            .take(10)
        if (unreviewed.isEmpty()) {
            status.text = if (candidates.isEmpty()) "নির্বাচিত ফোল্ডারে সমর্থিত গান পাওয়া যায়নি।"
            else "নতুন/অবিশ্লেষিত উপযুক্ত গান পাওয়া যায়নি। সর্বোচ্চ 20 MB-এর গান ও 10টি ফাইল করে বিশ্লেষণ করা হয়।"
            return true
        }
        val total = unreviewed.sumOf { it.length() }
        AlertDialog.Builder(activity)
            .setTitle("একাধিক গান বিশ্লেষণ")
            .setMessage("সর্বোচ্চ 10টি অবিশ্লেষিত গান Google Gemini-তে পাঠানো হবে (মোট ${total / (1024 * 1024)} MB)। বাংলা শিরোনাম, একাধিক বিষয়, সংক্ষিপ্ত ব্যাখ্যা এবং অনিশ্চয়তা ডিভাইসে রাখা হবে।\n\n${unreviewed.joinToString("\n") { "• ${it.name} (${it.length() / 1024} KB)" }}\n\nএতে আপনার নির্বাচিত ফোল্ডারের গানগুলোর অডিও Google-এ পাঠানোর সম্মতি দিচ্ছেন।")
            .setNegativeButton("বাতিল", null)
            .setPositiveButton("সম্মতি দিয়ে বিশ্লেষণ") { _, _ ->
                val results = mutableListOf<String>()
                fun runNext(index: Int) {
                    if (index >= unreviewed.size) {
                        status.text = "গান বিশ্লেষণ শেষ: ${results.size}/${unreviewed.size}টি সফল।\n" + results.joinToString("\n")
                        return
                    }
                    val file = unreviewed[index]
                    status.text = "গান বিশ্লেষণ ${index + 1}/${unreviewed.size}: ${file.name}"
                    AudioAnalysisClient.analyzeSelected(activity, file.uri) { result, error ->
                        activity.runOnUiThread {
                            if (activity.isFinishing) return@runOnUiThread
                            if (result != null) {
                                val topics = result.metadata.topics.joinToString("、") { it.bengaliLabel }
                                results += "• ${result.originalName} → ${result.metadata.bengaliTitle} [${topics}]"
                            } else results += "• ${file.name}: ব্যর্থ — ${error ?: "অজানা সমস্যা"}"
                            runNext(index + 1)
                        }
                    }
                }
                runNext(0)
            }.show()
        return true
    }

    private fun collectAudio(folder: DocumentFile, depth: Int, out: MutableList<DocumentFile>) {
        if (depth > 8 || out.size >= 500) return
        for (child in runCatching { folder.listFiles() }.getOrDefault(emptyArray())) {
            if (out.size >= 500) return
            if (child.isDirectory) collectAudio(child, depth + 1, out)
            else if (child.isFile && MediaLibraryAssistant.classify(child.name.orEmpty()) == MediaKind.AUDIO) out += child
        }
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
