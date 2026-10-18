package com.mosharrof.agent.files

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

data class ReviewedSongMetadata(
    val bengaliTitle: String,
    val topics: Set<SongTopic>,
    val summaryBengali: String,
    val uncertainty: String
)

/** Stores only reviewed metadata keyed by the selected content URI; audio bytes are never stored here. */
object SongMetadataStore {
    private const val PREFS = "mosharrof_song_metadata_v1"

    fun save(context: Context, uri: String, metadata: ReviewedSongMetadata) {
        require(uri.isNotBlank() && metadata.bengaliTitle.isNotBlank())
        val json = JSONObject()
            .put("title_bn", metadata.bengaliTitle.take(160))
            .put("summary_bn", metadata.summaryBengali.take(1200))
            .put("uncertainty", metadata.uncertainty.take(500))
            .put("topics", JSONArray(metadata.topics.map { it.name }))
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(key(uri), json.toString()).apply()
    }

    fun load(context: Context, uri: String): ReviewedSongMetadata? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(key(uri), null) ?: return null
        val json = JSONObject(raw)
        val topicsJson = json.optJSONArray("topics") ?: JSONArray()
        val topics = (0 until topicsJson.length()).mapNotNull { index ->
            runCatching { SongTopic.valueOf(topicsJson.getString(index)) }.getOrNull()
        }.toSet()
        ReviewedSongMetadata(
            bengaliTitle = json.optString("title_bn").takeIf { it.isNotBlank() } ?: return null,
            topics = topics.ifEmpty { setOf(SongTopic.UNKNOWN) },
            summaryBengali = json.optString("summary_bn"),
            uncertainty = json.optString("uncertainty")
        )
    }.getOrNull()

    fun clear(context: Context, uri: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(key(uri)).apply()
    }

    private fun key(uri: String): String = MessageDigest.getInstance("SHA-256")
        .digest(uri.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
}
