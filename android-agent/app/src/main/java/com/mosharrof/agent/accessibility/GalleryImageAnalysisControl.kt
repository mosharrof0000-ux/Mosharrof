package com.mosharrof.agent.accessibility

import android.app.Activity
import android.app.AlertDialog
import android.net.Uri
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.documentfile.provider.DocumentFile
import com.mosharrof.agent.files.ImageMetadataStore
import com.mosharrof.agent.files.MediaLibraryAssistant
import com.mosharrof.agent.files.MediaKind
import com.mosharrof.agent.vision.PhotoAnalysisClient

/** User-selected photo analysis with explicit consent for single images or a bounded folder batch. */
object GalleryImageAnalysisControl {
    fun addTo(activity: Activity, layout: LinearLayout, status: TextView, pickImage: () -> Unit) {
        layout.addView(Button(activity).apply {
            text = "গ্যালারির ছবি বিশ্লেষণ ও শ্রেণিবিন্যাস করুন"
            setOnClickListener { pickImage() }
        })
    }

    fun handleCommand(activity: Activity, rawCommand: String, status: TextView, pickImage: () -> Unit): Boolean {
        val command = rawCommand.lowercase()
        val matches = listOf("ছবি বিশ্লেষণ", "ছবিগুলো বিশ্লেষণ", "আমার ছবিগুলো বিশ্লেষণ", "ছবি এনালাইস", "ছবিগুলো এনালাইস", "আমার ছবিগুলো এনালাইস", "ছবি অ্যানালাইস", "সর্বশেষ স্ক্রিনশট", "স্ক্রিনশট বিশ্লেষণ", "latest screenshot", "analyze screenshot", "analyze image", "analyze photos", "analyze my photos", "photo analysis", "picture analysis", "গ্যালারির ছবি")
            .any { command.contains(it) }
        if (!matches) return false
        val saved = activity.getSharedPreferences("mosharrof_media_control", Activity.MODE_PRIVATE)
            .getString("selected_tree_uri", null)
        val root = saved?.let { runCatching { DocumentFile.fromTreeUri(activity, Uri.parse(it)) }.getOrNull() }
        if (root == null || !root.isDirectory) {
            status.text = "একটি ছবি বাছুন; একাধিক ছবির জন্য আগে মিডিয়া ফোল্ডার নির্বাচন করুন।"
            pickImage()
            return true
        }
        val candidates = mutableListOf<DocumentFile>()
        collectImages(root, 0, candidates)
        val unreviewed = candidates.filter { ImageMetadataStore.load(activity, it.uri.toString()) == null }
            .sortedBy { it.name.orEmpty() }.take(10)
        if (unreviewed.isEmpty()) {
            status.text = if (candidates.isEmpty()) "নির্বাচিত ফোল্ডারে সমর্থিত ছবি পাওয়া যায়নি।"
            else "নতুন/অবিশ্লেষিত ছবি পাওয়া যায়নি; সর্বোচ্চ 10টি করে বিশ্লেষণ হয়।"
            return true
        }
        AlertDialog.Builder(activity)
            .setTitle("একাধিক ছবি বিশ্লেষণ")
            .setMessage("সর্বোচ্চ 10টি অবিশ্লেষিত ছবি Google Gemini-তে পাঠানো হবে। প্রতিটির বাংলা বিবরণ ও বিষয়ভিত্তিক ফোল্ডার শ্রেণি তৈরি হবে।\n\n${unreviewed.joinToString("\n") { "• ${it.name}" }}\n\nআপনি এই নির্বাচিত ফোল্ডারের ছবিগুলো পাঠানোর সম্মতি দিচ্ছেন।")
            .setNegativeButton("বাতিল", null)
            .setPositiveButton("সম্মতি দিয়ে বিশ্লেষণ") { _, _ ->
                val results = mutableListOf<String>()
                fun runNext(index: Int) {
                    if (index >= unreviewed.size) {
                        status.text = "ছবি বিশ্লেষণ শেষ: ${results.size}/${unreviewed.size}টি সফল।\n" + results.joinToString("\n")
                        return
                    }
                    val file = unreviewed[index]
                    status.text = "ছবি বিশ্লেষণ ${index + 1}/${unreviewed.size}: ${file.name}"
                    PhotoAnalysisClient.analyzeSelected(activity, file.uri) { result, error ->
                        activity.runOnUiThread {
                            if (activity.isFinishing) return@runOnUiThread
                            if (result != null) {
                                results += "• ${result.fileName} → ${result.metadata.category.folderLabel}: ${result.metadata.summaryBengali}"
                            } else results += "• ${file.name}: ব্যর্থ — ${error ?: "অজানা সমস্যা"}"
                            runNext(index + 1)
                        }
                    }
                }
                runNext(0)
            }.show()
        return true
    }

    private fun collectImages(folder: DocumentFile, depth: Int, out: MutableList<DocumentFile>) {
        if (depth > 8 || out.size >= 500) return
        for (child in runCatching { folder.listFiles() }.getOrDefault(emptyArray())) {
            if (out.size >= 500) return
            if (child.isDirectory) collectImages(child, depth + 1, out)
            else if (child.isFile && MediaLibraryAssistant.classify(child.name.orEmpty()) == MediaKind.IMAGE) out += child
        }
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
            .setMessage("ছবি: $name\n\nসম্মতি দিলে ছবিটি Google Gemini-তে HTTPS দিয়ে পাঠানো হবে। ব্যক্তিগত/সংবেদনশীল তথ্য থাকলে বাতিল করুন।")
            .setNegativeButton("বাতিল", null)
            .setPositiveButton("সম্মতি দিয়ে বিশ্লেষণ") { _, _ ->
                status.text = "ছবি বিশ্লেষণ চলছে…"
                PhotoAnalysisClient.analyzeSelected(activity, uri) { result, error ->
                    activity.runOnUiThread {
                        if (activity.isFinishing) return@runOnUiThread
                        status.text = if (result == null) "ছবি বিশ্লেষণ ব্যর্থ: ${error ?: "অজানা সমস্যা"}"
                        else "ছবি বিশ্লেষণ সম্পন্ন • ${result.provider}\nবিভাগ: ${result.metadata.category.folderLabel}\nবিবরণ: ${result.metadata.summaryBengali}\nঅনিশ্চয়তা: ${result.metadata.uncertainty}\n\nফলাফল ডিভাইসে রাখা হয়েছে; ফাইলের নাম এখনো বদলায়নি।"
                    }
                }
            }.show()
    }
}
