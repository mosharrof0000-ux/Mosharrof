package com.mosharrof.agent.files

import android.app.Activity
import android.app.AlertDialog
import android.net.Uri
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.documentfile.provider.DocumentFile
import java.security.MessageDigest

/** Works only inside a folder explicitly selected by the device owner through Android's SAF picker. */
object UserFileAccessControl {
    private const val MAX_FILES = 1000
    private const val MAX_DEPTH = 8
    private const val MAX_HASH_FILE_BYTES = 25L * 1024 * 1024
    private const val MAX_TOTAL_HASH_BYTES = 200L * 1024 * 1024
    private var lastDuplicates: List<List<DocumentFile>> = emptyList()

    fun addTo(activity: Activity, layout: LinearLayout, status: TextView, pickFolder: () -> Unit) {
        layout.addView(Button(activity).apply {
            text = "ফাইল/ফোল্ডার বাছুন ও ডুপ্লিকেট পরীক্ষা করুন"
            setOnClickListener { pickFolder() }
        })
        layout.addView(Button(activity).apply {
            text = "পরীক্ষায় পাওয়া ডুপ্লিকেট পর্যালোচনা করুন"
            setOnClickListener { showDuplicates(activity, status) }
        })
    }

    fun scanSelectedFolder(activity: Activity, uri: Uri?, status: TextView) {
        if (uri == null) {
            status.text = "কোনো ফোল্ডার নির্বাচন করা হয়নি।"
            return
        }
        try {
            activity.contentResolver.takePersistableUriPermission(
                uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION or
                    android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
        } catch (_: SecurityException) {
            try {
                activity.contentResolver.takePersistableUriPermission(
                    uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            } catch (_: SecurityException) {
                status.text = "ফোল্ডার পড়ার অনুমতি পাওয়া যায়নি; Android picker থেকে অন্য ফোল্ডার নির্বাচন করুন।"
                return
            }
        }
        val root = DocumentFile.fromTreeUri(activity, uri)
        if (root == null || !root.isDirectory) {
            status.text = "নির্বাচিত ফোল্ডারটি পড়া যায়নি।"
            return
        }
        status.text = "নির্বাচিত ফোল্ডার স্ক্যান হচ্ছে; কোনো ফাইল এখনই মুছবে না…"
        Thread {
            val files = mutableListOf<DocumentFile>()
            collect(root, 0, files)
            val bySize = files.filter { it.isFile && it.length() > 0L }
                .groupBy { it.length() }.filterValues { it.size > 1 }
            var hashedBytes = 0L
            val groups = mutableListOf<List<DocumentFile>>()
            var skipped = 0
            for ((_, candidates) in bySize) {
                val eligible = mutableListOf<DocumentFile>()
                for (candidate in candidates) {
                    if (candidate.length() <= MAX_HASH_FILE_BYTES &&
                        hashedBytes + candidate.length() <= MAX_TOTAL_HASH_BYTES) {
                        eligible += candidate
                        hashedBytes += candidate.length()
                    } else skipped++
                }
                val hashes = eligible.mapNotNull { file ->
                    hash(activity, file)?.let { it to file }
                }.groupBy({ it.first }, { it.second })
                groups += hashes.values.filter { it.size > 1 }.map { it.sortedBy { file -> file.name.orEmpty() } }
            }
            lastDuplicates = groups
            val report = buildString {
                appendLine("নির্বাচিত ফোল্ডার স্ক্যান সম্পন্ন")
                appendLine("পাওয়া ফাইল: ${files.size}")
                appendLine("একই কনটেন্টের ডুপ্লিকেট গ্রুপ: ${groups.size}")
                appendLine("হ্যাশ করা হয়েছে: ${hashedBytes / (1024 * 1024)} MB")
                if (skipped > 0) appendLine("আকার/সীমার কারণে হ্যাশ করা হয়নি: ${skipped}টি")
                groups.take(12).forEachIndexed { index, group ->
                    appendLine("\n${index + 1}. ${group.size}টি একই ফাইল")
                    group.forEach { appendLine(" • ${it.name} (${it.length()} bytes)") }
                    appendLine("   প্রথম ফাইলটি রাখা হবে; বাকিগুলো শুধু পর্যালোচনার প্রস্তাব।")
                }
                if (groups.isEmpty()) appendLine("পরীক্ষার সীমার মধ্যে কোনো নিশ্চিত ডুপ্লিকেট পাওয়া যায়নি।")
                append("কোনো ফাইল স্বয়ংক্রিয়ভাবে মুছা হয়নি।")
            }
            activity.runOnUiThread {
                if (!activity.isFinishing) {
                    status.text = report
                    if (groups.isNotEmpty()) showDuplicates(activity, status)
                }
            }
        }.start()
    }

    private fun collect(folder: DocumentFile, depth: Int, out: MutableList<DocumentFile>) {
        if (depth > MAX_DEPTH || out.size >= MAX_FILES) return
        val children = runCatching { folder.listFiles() }.getOrDefault(emptyArray())
        for (child in children) {
            if (out.size >= MAX_FILES) return
            if (child.isDirectory) collect(child, depth + 1, out)
            else if (child.isFile) out += child
        }
    }

    private fun hash(activity: Activity, file: DocumentFile): String? {
        return try {
            val input = activity.contentResolver.openInputStream(file.uri) ?: return null
            val digest = MessageDigest.getInstance("SHA-256")
            input.use {
                val buffer = ByteArray(32 * 1024)
                while (true) {
                    val count = it.read(buffer)
                    if (count < 0) break
                    digest.update(buffer, 0, count)
                }
            }
            digest.digest().joinToString("") { "%02x".format(it) }
        } catch (_: Exception) {
            null
        }
    }

    private fun showDuplicates(activity: Activity, status: TextView) {
        val groups = lastDuplicates
        if (groups.isEmpty()) {
            status.text = "আগের স্ক্যানের নিশ্চিত ডুপ্লিকেট নেই; আগে একটি ফোল্ডার স্ক্যান করুন।"
            return
        }
        val details = groups.joinToString("\n\n") { group ->
            group.joinToString("\n") { "• ${it.name} (${it.length()} bytes)" }
        }.take(7000)
        AlertDialog.Builder(activity)
            .setTitle("ডুপ্লিকেট পর্যালোচনা • ${groups.size} গ্রুপ")
            .setMessage("$details\n\nপ্রতিটি গ্রুপে নাম অনুসারে প্রথম ফাইলটি রাখা হবে। অন্য ফাইলগুলো মুছতে আলাদা নিশ্চিতকরণ লাগবে।")
            .setNegativeButton("রাখুন, মুছবেন না", null)
            .setPositiveButton("ডুপ্লিকেট মুছুন…") { _, _ -> confirmDelete(activity, status, groups) }
            .show()
    }

    private fun confirmDelete(activity: Activity, status: TextView, groups: List<List<DocumentFile>>) {
        val targets = groups.flatMap { it.drop(1) }
        AlertDialog.Builder(activity)
            .setTitle("ফাইল স্থায়ীভাবে মুছবেন?")
            .setMessage("${targets.size}টি ডুপ্লিকেট ফাইল মুছতে বলা হবে। প্রথম কপি রাখা হবে। এই ফাইল মুছে ফেলার পর Android/স্টোরেজ প্রদানকারী পুনরুদ্ধারের সুযোগ নাও দিতে পারে।")
            .setNegativeButton("বাতিল", null)
            .setPositiveButton("হ্যাঁ, ডুপ্লিকেট মুছুন") { _, _ ->
                var deleted = 0
                var failed = 0
                targets.forEach { if (runCatching { it.delete() }.getOrDefault(false)) deleted++ else failed++ }
                lastDuplicates = emptyList()
                status.text = "ডুপ্লিকেট মুছে ফেলার ফল: ${deleted}টি মুছেছে, ${failed}টি মুছতে পারেনি।"
            }
            .show()
    }
}
