package com.mosharrof.agent.files

import java.text.Normalizer
import java.util.Locale

/** A metadata-only view of user-selected media. File bytes are not uploaded by this catalog. */
enum class MediaKind { IMAGE, AUDIO, VIDEO, DOCUMENT, ANDROID_PACKAGE, ARCHIVE, OTHER }

enum class SongTopic(val bengaliLabel: String) {
    BODY_PHILOSOPHY("দেহতত্ত্ব"),
    SOUL_PHILOSOPHY("আত্মতত্ত্ব"),
    GURU_PHILOSOPHY("গুরুতত্ত্ব"),
    LOVE("প্রেম"),
    DEVOTION("ভক্তি"),
    NATURE("প্রকৃতি"),
    SEPARATION("বিরহ"),
    SPIRITUAL_SEARCH("সাধনা ও আত্মঅনুসন্ধান"),
    UNKNOWN("বিষয় নির্ধারণ বাকি")
}

data class MediaRecord(
    val uri: String,
    val fileName: String,
    val kind: MediaKind,
    val sizeBytes: Long,
    val modifiedAtMillis: Long = 0L,
    /** Set only after the user approves an analysis result. */
    val bengaliTitle: String? = null,
    val topics: Set<SongTopic> = emptySet()
)

data class SongAnalysisDraft(
    val originalTitle: String,
    val suggestedBengaliTitle: String?,
    val topics: Set<SongTopic>,
    val evidenceTerms: List<String>,
    val needsReview: Boolean = true
)

/**
 * Bounded, deterministic first-pass classifier. It never claims to understand a whole song
 * from its filename; lyric/audio semantic analysis must supply a reviewed result separately.
 */
object MediaLibraryAssistant {
    private val extensions = mapOf(
        MediaKind.IMAGE to setOf("jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif"),
        MediaKind.AUDIO to setOf("mp3", "m4a", "aac", "wav", "ogg", "flac", "opus", "wma"),
        MediaKind.VIDEO to setOf("mp4", "mkv", "mov", "webm", "3gp", "avi", "mpeg", "m4v"),
        MediaKind.DOCUMENT to setOf("pdf", "txt", "md", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "epub"),
        MediaKind.ANDROID_PACKAGE to setOf("apk", "aab", "xapk", "apks"),
        MediaKind.ARCHIVE to setOf("zip", "rar", "7z", "tar", "gz")
    )

    private val topicTerms = linkedMapOf(
        SongTopic.BODY_PHILOSOPHY to listOf("দেহতত্ত্ব", "দেহ", "পিঞ্জর", "খাঁচা", "রক্ত", "মাংস", "body", "flesh", "body cage"),
        SongTopic.SOUL_PHILOSOPHY to listOf("আত্মতত্ত্ব", "আত্মা", "মন", "প্রাণ", "নফস", "soul", "self", "mind", "spirit"),
        SongTopic.GURU_PHILOSOPHY to listOf("গুরুতত্ত্ব", "গুরু", "মুর্শিদ", "পীর", "শিক্ষক", "guru", "murshid", "pir"),
        SongTopic.LOVE to listOf("প্রেম", "ভালোবাসা", "মহব্বত", "love", "beloved", "প্রিয়"),
        SongTopic.DEVOTION to listOf("ভক্তি", "ইবাদত", "জিকির", "নাম", "স্মরণ", "devotion", "prayer", "zikr"),
        SongTopic.NATURE to listOf("নদী", "নৌকা", "পাখি", "আকাশ", "চাঁদ", "নদীর", "river", "bird", "moon", "sky"),
        SongTopic.SEPARATION to listOf("বিরহ", "বিচ্ছেদ", "বেদনা", "কান্দি", "কাঁদি", "বিচ্ছেদ", "separation", "longing", "sorrow"),
        SongTopic.SPIRITUAL_SEARCH to listOf("সাধনা", "সত্য", "অনুসন্ধান", "মার্গ", "পথ", "সাঁই", "খোদা", "truth", "seeker", "path")
    )

    fun classify(fileName: String): MediaKind {
        val extension = fileName.substringAfterLast('.', "").lowercase(Locale.ROOT)
        return extensions.entries.firstOrNull { extension in it.value }?.key ?: MediaKind.OTHER
    }

    /** Filename clues only: result is a draft, never a definitive interpretation of lyrics. */
    fun draftSongTopics(titleOrLyrics: String): SongAnalysisDraft {
        val normalized = normalize(titleOrLyrics)
        val matches = topicTerms.mapNotNull { (topic, terms) ->
            val evidence = terms.filter { normalize(it).isNotBlank() && normalized.contains(normalize(it)) }
            if (evidence.isEmpty()) null else topic to evidence
        }
        return SongAnalysisDraft(
            originalTitle = titleOrLyrics.take(240),
            suggestedBengaliTitle = null,
            topics = matches.map { it.first }.toSet().ifEmpty { setOf(SongTopic.UNKNOWN) },
            evidenceTerms = matches.flatMap { it.second }.distinct().take(20),
            needsReview = true
        )
    }

    fun groupSongsByTopic(records: List<MediaRecord>): Map<SongTopic, List<MediaRecord>> =
        records.filter { it.kind == MediaKind.AUDIO }
            .flatMap { record ->
                (record.topics.ifEmpty { setOf(SongTopic.UNKNOWN) }).map { topic -> topic to record }
            }
            .groupBy({ it.first }, { it.second })
            .mapValues { (_, songs) -> songs.distinctBy { it.uri }.sortedBy { it.bengaliTitle ?: it.fileName } }

    /** User-approved localized title takes precedence; don't silently transliterate inaccurately. */
    fun displayTitle(record: MediaRecord): String = record.bengaliTitle?.takeIf { it.isNotBlank() } ?: record.fileName

    private fun normalize(value: String): String =
        Normalizer.normalize(value, Normalizer.Form.NFC)
            .replace(Regex("[\\u200B-\\u200D\\uFEFF]"), "")
            .lowercase(Locale.ROOT)
}
