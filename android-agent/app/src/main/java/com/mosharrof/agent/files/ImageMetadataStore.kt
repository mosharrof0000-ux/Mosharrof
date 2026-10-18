package com.mosharrof.agent.files

import android.content.Context
import org.json.JSONObject
import java.security.MessageDigest

enum class PhotoCategory(val folderLabel: String) {
    SCREENSHOT("স্ক্রিনশট"),
    DOCUMENT("ডকুমেন্ট"),
    NATURE("প্রকৃতি"),
    FOOD("খাবার"),
    ANIMALS("প্রাণী"),
    TRAVEL("ভ্রমণ"),
    ART("শিল্প"),
    OBJECTS("বস্তু"),
    OTHER("অন্যান্য")
}

data class PhotoMetadata(val category: PhotoCategory, val summaryBengali: String, val uncertainty: String)

object ImageMetadataStore {
    private const val PREFS = "mosharrof_image_metadata_v1"

    fun save(context: Context, uri: String, metadata: PhotoMetadata) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(key(uri), JSONObject()
                .put("category", metadata.category.name)
                .put("summary", metadata.summaryBengali.take(1200))
                .put("uncertainty", metadata.uncertainty.take(500))
                .toString()).apply()
    }

    fun load(context: Context, uri: String): PhotoMetadata? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(key(uri), null) ?: return null
        val json = JSONObject(raw)
        PhotoMetadata(
            category = runCatching { PhotoCategory.valueOf(json.getString("category")) }.getOrDefault(PhotoCategory.OTHER),
            summaryBengali = json.optString("summary"),
            uncertainty = json.optString("uncertainty")
        )
    }.getOrNull()

    private fun key(uri: String): String = MessageDigest.getInstance("SHA-256")
        .digest(uri.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
}
