package com.mosharrof.agent.files

/** A transparent, reviewable organization proposal; planning never moves or deletes files. */
data class FolderMoveSuggestion(
    val sourceUri: String,
    val sourceName: String,
    val destinationFolder: String,
    val reason: String
)

object MediaFolderPlanner {
    fun plan(records: List<MediaRecord>): List<FolderMoveSuggestion> =
        records.mapNotNull { record ->
            val folder = when (record.kind) {
                MediaKind.IMAGE -> "ছবি"
                MediaKind.AUDIO -> {
                    val topics = record.topics - SongTopic.UNKNOWN
                    if (topics.isEmpty()) "গান/বিষয় নির্ধারণ বাকি"
                    else "গান/" + topics.sortedBy { it.bengaliLabel }.joinToString(" + ") { it.bengaliLabel }
                }
                MediaKind.VIDEO -> "ভিডিও"
                MediaKind.DOCUMENT -> "ডকুমেন্ট"
                MediaKind.ANDROID_PACKAGE -> "অ্যাপ ইনস্টলার"
                MediaKind.ARCHIVE -> "আর্কাইভ"
                MediaKind.OTHER -> null
            } ?: return@mapNotNull null
            FolderMoveSuggestion(
                sourceUri = record.uri,
                sourceName = record.fileName,
                destinationFolder = folder,
                reason = when (record.kind) {
                    MediaKind.AUDIO -> "গানের ধরন/বিষয় অনুযায়ী প্রস্তাব; বিষয় নিশ্চিত না হলে আলাদা রাখা হবে"
                    else -> "ফাইলের extension অনুযায়ী প্রাথমিক শ্রেণিবিন্যাস"
                }
            )
        }
}
