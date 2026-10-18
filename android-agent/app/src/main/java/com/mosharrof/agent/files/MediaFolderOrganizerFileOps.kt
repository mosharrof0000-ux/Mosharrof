package com.mosharrof.agent.files

import android.app.Activity
import androidx.documentfile.provider.DocumentFile

/** File naming, destination creation and topic playlist helpers for media organization. */
object MediaFolderOrganizerFileOps {
    fun localizedName(originalName: String, metadata: ReviewedSongMetadata?): String {
        if (metadata == null) return originalName
        val title = metadata.bengaliTitle.map { ch ->
            if (ch in "/:*?<>|" || ch.isISOControl() || ch == '\\') ' ' else ch
        }.joinToString("").trim().take(100)
        if (title.isBlank()) return originalName
        val extension = originalName.substringAfterLast('.', "").takeIf { it.isNotBlank() }
        return if (extension == null) title else "$title.$extension"
    }

    fun writeTopicPlaylists(
        activity: Activity,
        root: DocumentFile,
        playlists: Map<SongTopic, List<String>>,
        onWriteFailure: (DocumentFile) -> Unit
    ): Int {
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
                activity.contentResolver.openOutputStream(playlist.uri, "w")?.use {
                    it.write(body.toByteArray(Charsets.UTF_8))
                } ?: return@runCatching false
                true
            }.getOrDefault(false)
            if (written) created++ else onWriteFailure(playlist)
        }
        return created
    }

    fun ensureFolder(root: DocumentFile, path: String): DocumentFile? {
        var current = root
        for (part in path.split('/').filter { it.isNotBlank() }) {
            current = current.findFile(part)?.takeIf { it.isDirectory } ?: current.createDirectory(part) ?: return null
        }
        return current
    }

    fun uniqueName(folder: DocumentFile, name: String): String {
        if (folder.findFile(name) == null) return name
        val base = name.substringBeforeLast('.', name)
        val ext = name.substringAfterLast('.', "")
        for (index in 1..999) {
            val candidate = if (ext.isBlank()) "${base}_${index}" else "${base}_${index}.${ext}"
            if (folder.findFile(candidate) == null) return candidate
        }
        return "${System.currentTimeMillis()}_${name}"
    }

    fun mimeFor(name: String): String = when (MediaLibraryAssistant.classify(name)) {
        MediaKind.IMAGE -> "image/*"
        MediaKind.AUDIO -> "audio/*"
        MediaKind.VIDEO -> "video/*"
        MediaKind.DOCUMENT -> "application/octet-stream"
        MediaKind.ANDROID_PACKAGE -> "application/vnd.android.package-archive"
        MediaKind.ARCHIVE -> "application/zip"
        MediaKind.OTHER -> "application/octet-stream"
    }
}
