package com.mosharrof.agent.files

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.documentfile.provider.DocumentFile

/**
 * User-selected-folder organizer. It previews the plan first, copies and verifies each file,
 * then deletes the original only after explicit confirmation. It never scans outside the SAF tree.
 */
object MediaFolderOrganizerControl {
    private const val MAX_FILES = 1000
    private const val MAX_DEPTH = 8
    private const val MAX_TOTAL_MOVE_BYTES = 500L * 1024L * 1024L
    private var pendingMoves: List<Pair<DocumentFile, FolderMoveSuggestion>> = emptyList()
    private var pendingRoot: DocumentFile? = null
    private var pendingActivity: Activity? = null
    private var pendingStatus: TextView? = null

    fun addTo(activity: Activity, layout: LinearLayout, status: TextView, pickFolder: () -> Unit) {
        layout.addView(Button(activity).apply {
            text = "ছবি/গান/ভিডিও বিষয়ভিত্তিক ফোল্ডারে সাজান"
            setOnClickListener { pickFolder() }
        })
        layout.addView(Button(activity).apply {
            text = "ফোল্ডার সাজানোর প্রস্তাব পর্যালোচনা করুন"
            setOnClickListener { showPlan(activity, status) }
        })
    }

    fun scanSelectedFolder(activity: Activity, uri: Uri?, status: TextView) {
        if (uri == null) {
            status.text = "ফোল্ডার নির্বাচন বাতিল হয়েছে; কোনো ফাইল বদলায়নি।"
            return
        }
        try {
            activity.contentResolver.takePersistableUriPermission(
                uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
        } catch (_: SecurityException) {
            runCatching { activity.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
                .onFailure {
                    status.text = "ফোল্ডারের অনুমতি পাওয়া যায়নি; Android picker থেকে আবার নির্বাচন করুন।"
                    return
                }
        }
        val root = DocumentFile.fromTreeUri(activity, uri)
        if (root == null || !root.isDirectory) {
            status.text = "নির্বাচিত ফোল্ডারটি পড়া যায়নি।"
            return
        }
        status.text = "নির্বাচিত ফোল্ডার বিশ্লেষণ হচ্ছে; এখনো কোনো ফাইল সরানো হচ্ছে না…"
        Thread {
            val files = mutableListOf<DocumentFile>()
            collect(root, 0, files)
            val candidates = files.filter { it.isFile }.mapNotNull { file ->
                val name = file.name ?: return@mapNotNull null
                val kind = MediaLibraryAssistant.classify(name)
                val reviewed = if (kind == MediaKind.AUDIO) SongMetadataStore.load(activity, file.uri.toString()) else null
                val topics = reviewed?.topics ?: if (kind == MediaKind.AUDIO) {
                    MediaLibraryAssistant.draftSongTopics(name).topics - SongTopic.UNKNOWN
                } else emptySet()
                val record = MediaRecord(
                    file.uri.toString(), name, kind, file.length(),
                    bengaliTitle = reviewed?.bengaliTitle, topics = topics
                )
                MediaFolderPlanner.plan(listOf(record)).firstOrNull()?.let { file to it }
            }
            val kindCounts = files.filter { it.isFile }.groupingBy { MediaLibraryAssistant.classify(it.name.orEmpty()) }.eachCount()
            val risks = files.filter { it.isFile }.map { it to FileRiskScanner.inspect(it.name.orEmpty(), it.type) }
                .filter { (_, finding) -> finding.level != FileRiskLevel.REVIEW || finding.reasons.none { it.startsWith("শুধু নামভিত্তিক") } }
            synchronized(this) {
                pendingMoves = candidates
                pendingRoot = root
                pendingActivity = activity
                pendingStatus = status
            }
            val report = buildString {
                appendLine("ফোল্ডার বিশ্লেষণ সম্পন্ন")
                appendLine("পরীক্ষিত ফাইল: ${files.size}")
                kindCounts.entries.sortedBy { it.key.name }.forEach { appendLine("• ${it.key}: ${it.value}") }
                appendLine("ফোল্ডারে সাজানোর প্রস্তাব: ${candidates.size}টি")
                appendLine("পর্যালোচনার জন্য সন্দেহজনক নাম/ধরন: ${risks.size}টি")
                candidates.take(18).forEach { (_, move) -> appendLine("• ${move.sourceName} → ${move.destinationFolder}") }
                risks.take(8).forEach { (file, finding) -> appendLine("⚠ ${file.name}: ${finding.reasons.firstOrNull()}") }
                appendLine()
                append("এটি ফাইলের নাম/ধরনভিত্তিক পরীক্ষা; পূর্ণ অ্যান্টিভাইরাস স্ক্যান নয়। কোনো ফাইল স্বয়ংক্রিয়ভাবে বদলানো হয়নি।")
            }
            activity.runOnUiThread {
                if (!activity.isFinishing) {
                    status.text = report
                    if (candidates.isNotEmpty()) showPlan(activity, status)
                }
            }
        }.start()
    }

    private fun collect(folder: DocumentFile, depth: Int, out: MutableList<DocumentFile>) {
        if (depth > MAX_DEPTH || out.size >= MAX_FILES) return
        val managedFolders = setOf("ছবি", "ভিডিও", "ডকুমেন্ট", "অ্যাপ ইনস্টলার", "আর্কাইভ", "গান", "গান/বিষয় নির্ধারণ বাকি")
        for (child in runCatching { folder.listFiles() }.getOrDefault(emptyArray())) {
            if (out.size >= MAX_FILES) return
            if (child.isDirectory) {
                if (child.name !in managedFolders) collect(child, depth + 1, out)
            } else if (child.isFile) out += child
        }
    }

    private fun showPlan(activity: Activity, status: TextView) {
        val moves = synchronized(this) { pendingMoves }
        val root = synchronized(this) { pendingRoot }
        if (root == null || moves.isEmpty()) {
            status.text = "সাজানোর প্রস্তাব নেই। আগে একটি ফোল্ডার নির্বাচন করে বিশ্লেষণ করুন।"
            return
        }
        val total = moves.sumOf { it.first.length().coerceAtLeast(0L) }
        val details = moves.take(24).joinToString("\n") { (file, move) -> "• ${file.name} → ${move.destinationFolder}" }
        AlertDialog.Builder(activity)
            .setTitle("ফোল্ডার সাজানোর প্রস্তাব • ${moves.size}টি ফাইল")
            .setMessage("$details\n\nমোট আকার: ${total / (1024 * 1024)} MB\nপ্রতিটি ফাইল নতুন ফোল্ডারে কপি করে আকার যাচাইয়ের পরই মূল কপি মুছতে চেষ্টা করা হবে। সর্বোচ্চ 500 MB পর্যন্ত; ব্যর্থ হলে মূল ফাইল রাখা হবে।")
            .setNegativeButton("এখন নয়", null)
            .setPositiveButton("পর্যালোচনা করে সাজান") { _, _ -> confirmAndOrganize(activity, status, moves, root, total) }
            .show()
    }

    private fun confirmAndOrganize(
        activity: Activity,
        status: TextView,
        moves: List<Pair<DocumentFile, FolderMoveSuggestion>>,
        root: DocumentFile,
        totalBytes: Long
    ) {
        if (totalBytes > MAX_TOTAL_MOVE_BYTES) {
            status.text = "নিরাপত্তা সীমা: এই প্রস্তাব 500 MB-এর বেশি; ছোট ফোল্ডার/ব্যাচ বেছে নিন। কোনো ফাইল সরানো হয়নি।"
            return
        }
        val playlists = mutableMapOf<SongTopic, MutableList<String>>()
        AlertDialog.Builder(activity)
            .setTitle("মূল ফাইল সরানোর চূড়ান্ত অনুমতি")
            .setMessage("নতুন ফোল্ডারে কপি ও আকার যাচাই সফল হলে মূল ফাইল মুছতে চেষ্টা করা হবে। স্টোরেজ প্রদানকারী মুছতে না দিলে মূল ফাইল থাকবে এবং কপি তৈরি হতে পারে। এগিয়ে যাবেন?")
            .setNegativeButton("বাতিল", null)
            .setPositiveButton("হ্যাঁ, সাজান") { _, _ ->
                status.text = "ফাইল সাজানো হচ্ছে; কপি ও যাচাই না হওয়া পর্যন্ত মূল ফাইল রাখা হবে…"
                Thread {
                    var moved = 0
                    var copiedKept = 0
                    var failed = 0
                    for ((source, suggestion) in moves) {
                        try {
                            val destination = ensureFolder(root, suggestion.destinationFolder)
                            if (destination == null) {
                                failed++
                                continue
                            }
                            val originalName = source.name
                            if (originalName == null) {
                                failed++
                                continue
                            }
                            val reviewedSong = if (MediaLibraryAssistant.classify(originalName) == MediaKind.AUDIO)
                                SongMetadataStore.load(activity, source.uri.toString()) else null
                            val proposedName = localizedName(originalName, reviewedSong)
                            val targetName = uniqueName(destination, proposedName)
                            val target = destination.createFile(source.type ?: mimeFor(originalName), targetName)
                            if (target == null) {
                                failed++
                                continue
                            }
                            val copied = activity.contentResolver.openInputStream(source.uri)?.use { input ->
                                activity.contentResolver.openOutputStream(target.uri, "w")?.use { output ->
                                    val buffer = ByteArray(32 * 1024)
                                    var count = 0L
                                    while (true) {
                                        val n = input.read(buffer)
                                        if (n < 0) break
                                        output.write(buffer, 0, n)
                                        count += n
                                    }
                                    output.flush()
                                    count
                                }
                            }
                            if (copied == null || copied != source.length() || target.length() != source.length()) {
                                runCatching { target.delete() }
                                failed++
                                continue
                            }
                            if (reviewedSong != null) {
                        val folderName = suggestion.destinationFolder.substringAfterLast('/')
                        reviewedSong.topics.filter { it != SongTopic.UNKNOWN }.forEach { topic ->
                            playlists.getOrPut(topic) { mutableListOf() }.add("$folderName/$targetName")
                        }
                    }
                    if (runCatching { source.delete() }.getOrDefault(false)) moved++ else copiedKept++
                        } catch (_: Exception) { failed++ }
                    }
                    val playlistCount = writeTopicPlaylists(root, playlists)
                    activity.runOnUiThread {
                        if (!activity.isFinishing) status.text =
                            "ফোল্ডার সাজানোর ফল: ${moved}টি কপি-যাচাই করে মূল স্থান থেকে সরেছে; ${copiedKept}টি কপি হয়েছে কিন্তু মূল ফাইল রাখা হয়েছে; ${failed}টি ব্যর্থ।\nবিষয়ভিত্তিক প্লেলিস্ট তৈরি: ${playlistCount}টি।"
                    }
                }.start()
            }.show()
    }

    private fun localizedName(originalName: String, metadata: ReviewedSongMetadata?): String {
        if (metadata == null) return originalName
        val title = metadata.bengaliTitle.map { ch ->
            if (ch in "/:*?<>|" || ch.isISOControl() || ch == '\\') ' ' else ch
        }.joinToString("").trim().take(100)
        if (title.isBlank()) return originalName
        val extension = originalName.substringAfterLast('.', "").takeIf { it.isNotBlank() }
        return if (extension == null) title else "$title.$extension"
    }

    private fun writeTopicPlaylists(root: DocumentFile, playlists: Map<SongTopic, List<String>>): Int {
        val songRoot = ensureFolder(root, "গান") ?: return 0
        var created = 0
        for ((topic, tracks) in playlists) {
            if (tracks.isEmpty()) continue
            val name = uniqueName(songRoot, "${topic.bengaliLabel}.m3u")
            val playlist = songRoot.createFile("audio/x-mpegurl", name) ?: continue
            val body = buildString {
                appendLine("#EXTM3U")
                tracks.distinct().forEach { appendLine(it) }
            }
            val written = runCatching {
                val context = pendingActivity ?: return@runCatching false
                context.contentResolver.openOutputStream(playlist.uri, "w")?.use {
                    it.write(body.toByteArray(Charsets.UTF_8))
                } ?: return@runCatching false
                true
            }.getOrDefault(false)
            if (written) created++ else runCatching { playlist.delete() }
        }
        return created
    }

    private fun ensureFolder(root: DocumentFile, path: String): DocumentFile? {
        var current = root
        for (part in path.split('/').filter { it.isNotBlank() }) {
            current = current.findFile(part)?.takeIf { it.isDirectory } ?: current.createDirectory(part) ?: return null
        }
        return current
    }

    private fun uniqueName(folder: DocumentFile, name: String): String {
        if (folder.findFile(name) == null) return name
        val base = name.substringBeforeLast('.', name)
        val ext = name.substringAfterLast('.', "")
        for (index in 1..999) {
            val candidate = if (ext.isBlank()) "${base}_${index}" else "${base}_${index}.${ext}"
            if (folder.findFile(candidate) == null) return candidate
        }
        return "${System.currentTimeMillis()}_${name}"
    }

    private fun mimeFor(name: String): String = when (MediaLibraryAssistant.classify(name)) {
        MediaKind.IMAGE -> "image/*"
        MediaKind.AUDIO -> "audio/*"
        MediaKind.VIDEO -> "video/*"
        MediaKind.DOCUMENT -> "application/octet-stream"
        MediaKind.ANDROID_PACKAGE -> "application/vnd.android.package-archive"
        MediaKind.ARCHIVE -> "application/zip"
        MediaKind.OTHER -> "application/octet-stream"
    }
}
