package com.mosharrof.agent.vision

import android.content.Context
import android.net.Uri
import android.util.Base64
import com.mosharrof.agent.files.MediaLibraryAssistant
import com.mosharrof.agent.files.ReviewedSongMetadata
import com.mosharrof.agent.files.SongMetadataStore
import com.mosharrof.agent.files.SongTopic
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

data class AudioAnalysisResult(
    val originalName: String,
    val metadata: ReviewedSongMetadata,
    val provider: String = "Google Gemini",
    val model: String = "gemini-2.5-flash"
)

/** Uploads a single owner-selected audio file only after AudioAnalysisControl obtains explicit consent. */
object AudioAnalysisClient {
    private val executor = Executors.newSingleThreadExecutor()
    private const val MAX_AUDIO_BYTES = 20 * 1024 * 1024
    private const val MODEL = "gemini-2.5-flash"
    private const val ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/$MODEL:generateContent"

    fun analyzeSelected(context: Context, uri: Uri, callback: (AudioAnalysisResult?, String?) -> Unit) {
        val key = SecureApiKeyStore.load(context)
        if (key.isNullOrBlank()) {
            callback(null, "Gemini API key সেট করা নেই। আগে স্ক্রিনশট বিশ্লেষণ অংশে key সংরক্ষণ করুন।")
            return
        }
        executor.execute {
            val outcome = runCatching {
                val resolver = context.contentResolver
                val name = runCatching {
                    resolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                        if (cursor.moveToFirst()) cursor.getString(0) else null
                    }
                }.getOrNull().orEmpty().ifBlank { "নির্বাচিত অডিও" }
                val bytes = resolver.openInputStream(uri)?.use { input ->
                    val output = java.io.ByteArrayOutputStream()
                    val buffer = ByteArray(16 * 1024)
                    var total = 0
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        total += count
                        require(total <= MAX_AUDIO_BYTES) { "অডিও ফাইল 20 MB সীমা ছাড়িয়েছে; ছোট ফাইল নির্বাচন করুন।" }
                        output.write(buffer, 0, count)
                    }
                    output.toByteArray()
                } ?: throw IllegalStateException("নির্বাচিত অডিও পড়া যায়নি")
                require(bytes.isNotEmpty()) { "অডিও ফাইল খালি" }
                val resolvedMime = resolver.getType(uri)
                val mime = if (resolvedMime?.startsWith("audio/") == true) resolvedMime else mimeFromName(name)
                require(mime.startsWith("audio/")) { "নির্বাচিত ফাইলটি অডিও নয়" }
                val metadata = request(name, bytes, mime, key)
                SongMetadataStore.save(context, uri.toString(), metadata)
                AudioAnalysisResult(name, metadata)
            }
            callback(outcome.getOrNull(), outcome.exceptionOrNull()?.message ?: if (outcome.isFailure) "অডিও বিশ্লেষণ ব্যর্থ হয়েছে" else null)
        }
    }

    private fun request(name: String, bytes: ByteArray, mime: String, key: String): ReviewedSongMetadata {
        val prompt = """
            Analyze the user-provided song/audio for cataloging. Do not reproduce full lyrics or long copyrighted passages.
            Return only JSON keys: bengali_title (write the title in Bengali script; preserve meaning/proper names and do not invent an official title),
            topics (array using only these exact labels when supported: দেহতত্ত্ব, আত্মতত্ত্ব, গুরুতত্ত্ব, প্রেম, ভক্তি, প্রকৃতি, বিরহ, সাধনা ও আত্মঅনুসন্ধান),
            summary_bengali (brief Bengali summary of the song's ideas, not a lyric transcription),
            uncertainty (Bengali note about unclear audio or interpretation).
            A song may contain multiple topics. Be cautious: do not force a topic when evidence is weak.
            Filename: ${name.take(160)}
        """.trimIndent()
        val parts = JSONArray()
            .put(JSONObject().put("text", prompt))
            .put(JSONObject().put("inline_data", JSONObject()
                .put("mime_type", mime)
                .put("data", Base64.encodeToString(bytes, Base64.NO_WRAP))))
        val payload = JSONObject()
            .put("contents", JSONArray().put(JSONObject().put("parts", parts)))
            .put("generationConfig", JSONObject().put("temperature", 0.2).put("maxOutputTokens", 900).put("responseMimeType", "application/json"))
        val connection = (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 60_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("x-goog-api-key", key)
        }
        try {
            connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (code !in 200..299) {
                val message = runCatching { JSONObject(body).optJSONObject("error")?.optString("message") }.getOrNull()
                throw IllegalStateException("Gemini HTTP $code: ${message?.take(180).orEmpty().ifBlank { "অনুরোধ গ্রহণ হয়নি" }}")
            }
            val responseParts = JSONObject(body).optJSONArray("candidates")?.optJSONObject(0)
                ?.optJSONObject("content")?.optJSONArray("parts") ?: JSONArray()
            val raw = (0 until responseParts.length()).mapNotNull {
                responseParts.optJSONObject(it)?.optString("text")?.takeIf(String::isNotBlank)
            }.joinToString("\n")
            val json = JSONObject(raw)
            val title = json.optString("bengali_title").trim()
            require(title.isNotBlank() && title != "null") { "AI বাংলা শিরোনাম দিতে পারেনি" }
            val topicArray = json.optJSONArray("topics") ?: JSONArray()
            val topics = (0 until topicArray.length()).mapNotNull { index ->
                val label = topicArray.optString(index)
                SongTopic.entries.firstOrNull { it.bengaliLabel == label || it.name == label }
            }.filter { it != SongTopic.UNKNOWN }.toSet().ifEmpty { setOf(SongTopic.UNKNOWN) }
            return ReviewedSongMetadata(
                bengaliTitle = title.take(160),
                topics = topics,
                summaryBengali = json.optString("summary_bengali").take(1200),
                uncertainty = json.optString("uncertainty").take(500)
            )
        } finally {
            connection.disconnect()
        }
    }

    private fun mimeFromName(name: String): String = when (MediaLibraryAssistant.classify(name)) {
        com.mosharrof.agent.files.MediaKind.AUDIO -> when (name.substringAfterLast('.', "").lowercase()) {
            "mp3" -> "audio/mpeg"
            "wav" -> "audio/wav"
            "m4a", "aac" -> "audio/mp4"
            "flac" -> "audio/flac"
            "ogg", "opus" -> "audio/ogg"
            else -> "audio/mpeg"
        }
        else -> "application/octet-stream"
    }
}
