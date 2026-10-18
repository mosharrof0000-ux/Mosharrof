package com.mosharrof.agent.vision

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import com.mosharrof.agent.files.ImageMetadataStore
import com.mosharrof.agent.files.PhotoCategory
import com.mosharrof.agent.files.PhotoMetadata
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

data class PhotoAnalysisResult(val fileName: String, val metadata: PhotoMetadata, val provider: String = "Google Gemini")

/** Sends one user-selected photo only after the UI obtains explicit consent. */
object PhotoAnalysisClient {
    private val executor = Executors.newSingleThreadExecutor()
    private const val MAX_IMAGE_BYTES = 4 * 1024 * 1024
    private const val MODEL = "gemini-2.5-flash"
    private const val ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/$MODEL:generateContent"

    fun analyzeSelected(context: Context, uri: Uri, callback: (PhotoAnalysisResult?, String?) -> Unit) {
        val key = SecureApiKeyStore.load(context)
        if (key.isNullOrBlank()) {
            callback(null, "Gemini API key সেট করা নেই। আগে API key সংরক্ষণ করুন।")
            return
        }
        executor.execute {
            val outcome = runCatching {
                val resolver = context.contentResolver
                val name = runCatching {
                    resolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                        if (cursor.moveToFirst()) cursor.getString(0) else null
                    }
                }.getOrNull().orEmpty().ifBlank { "নির্বাচিত ছবি" }
                val bitmap = decodeBounded(context, uri) ?: throw IllegalStateException("ছবি পড়া যায়নি")
                try {
                    val bytes = ByteArrayOutputStream().use { output ->
                        bitmap.compress(Bitmap.CompressFormat.JPEG, 78, output)
                        output.toByteArray()
                    }
                    require(bytes.size <= MAX_IMAGE_BYTES) { "ছবিটি API সীমার চেয়ে বড়" }
                    val metadata = request(name, bytes, key)
                    ImageMetadataStore.save(context, uri.toString(), metadata)
                    PhotoAnalysisResult(name, metadata)
                } finally {
                    bitmap.recycle()
                }
            }
            callback(outcome.getOrNull(), outcome.exceptionOrNull()?.message ?: if (outcome.isFailure) "ছবি বিশ্লেষণ ব্যর্থ" else null)
        }
    }

    private fun decodeBounded(context: Context, uri: Uri): Bitmap? {
        val resolver = context.contentResolver
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) } ?: return null
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (bounds.outWidth / sample > 2048 || bounds.outHeight / sample > 2048) sample *= 2
        return resolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply {
                inSampleSize = sample
                inPreferredConfig = Bitmap.Config.ARGB_8888
            })
        }
    }

    private fun request(name: String, bytes: ByteArray, key: String): PhotoMetadata {
        val prompt = """
            Classify this user-provided image for personal folder organization. Do not identify people or infer sensitive traits.
            Return only JSON: category (exactly one of স্ক্রিনশট, ডকুমেন্ট, প্রকৃতি, খাবার, প্রাণী, ভ্রমণ, শিল্প, বস্তু, অন্যান্য),
            summary_bengali (short factual Bengali description of visible content),
            uncertainty (Bengali uncertainty note). Do not guess identities or hidden context.
            Filename: ${name.take(160)}
        """.trimIndent()
        val parts = JSONArray()
            .put(JSONObject().put("text", prompt))
            .put(JSONObject().put("inline_data", JSONObject()
                .put("mime_type", "image/jpeg")
                .put("data", Base64.encodeToString(bytes, Base64.NO_WRAP))))
        val payload = JSONObject()
            .put("contents", JSONArray().put(JSONObject().put("parts", parts)))
            .put("generationConfig", JSONObject().put("temperature", 0.2).put("maxOutputTokens", 500).put("responseMimeType", "application/json"))
        val connection = (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 45_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("x-goog-api-key", key)
        }
        try {
            connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (code !in 200..299) throw IllegalStateException("Gemini HTTP $code")
            val partsOut = JSONObject(body).optJSONArray("candidates")?.optJSONObject(0)
                ?.optJSONObject("content")?.optJSONArray("parts") ?: JSONArray()
            val raw = (0 until partsOut.length()).mapNotNull {
                partsOut.optJSONObject(it)?.optString("text")?.takeIf(String::isNotBlank)
            }.joinToString("\n")
            val json = JSONObject(raw)
            val categoryLabel = json.optString("category")
            val category = PhotoCategory.entries.firstOrNull { it.folderLabel == categoryLabel }
                ?: PhotoCategory.OTHER
            return PhotoMetadata(category, json.optString("summary_bengali").take(1200), json.optString("uncertainty").take(500))
        } finally {
            connection.disconnect()
        }
    }
}
