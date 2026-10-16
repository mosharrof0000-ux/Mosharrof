package com.mosharrof.agent.vision

import android.content.Context
import android.graphics.Bitmap
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

data class VisionAnalysisResult(val text: String, val provider: String, val model: String)

/** Calls Gemini Vision only after the user taps the explicit upload-and-analyze button. */
object VisionAnalysisClient {
    private val executor = Executors.newSingleThreadExecutor()

    fun analyze(context: Context, bitmap: Bitmap, callback: (VisionAnalysisResult?, String?) -> Unit) {
        val key = SecureApiKeyStore.load(context)
        if (key.isNullOrBlank()) {
            callback(null, "Gemini API key সেট করা নেই। আগে ‘Gemini API key সেট করুন’ চাপুন।")
            return
        }
        executor.execute {
            val result = runCatching { request(bitmap, key) }
            callback(result.getOrNull(), result.exceptionOrNull()?.let {
                "AI Vision ব্যর্থ: ${it.message ?: "নেটওয়ার্ক বা API সমস্যা"}"
            })
        }
    }

    private fun request(bitmap: Bitmap, key: String): VisionAnalysisResult {
        val image = ByteArrayOutputStream().use { output ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, 78, output)
            output.toByteArray()
        }
        require(image.size <= MAX_IMAGE_BYTES) { "স্ক্রিনশট API সীমার চেয়ে বড়।" }
        val parts = JSONArray()
            .put(JSONObject().put("text", PROMPT))
            .put(JSONObject().put("inline_data", JSONObject()
                .put("mime_type", "image/jpeg")
                .put("data", Base64.encodeToString(image, Base64.NO_WRAP))))
        val payload = JSONObject()
            .put("contents", JSONArray().put(JSONObject().put("parts", parts)))
            .put("generationConfig", JSONObject().put("temperature", 0.2).put("maxOutputTokens", 700))
        val connection = (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 35_000
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
                throw IllegalStateException("Gemini HTTP $code: ${message?.take(220).orEmpty().ifBlank { "অনুরোধ গ্রহণ হয়নি" }}")
            }
            val candidates = JSONObject(body).optJSONArray("candidates") ?: throw IllegalStateException("AI কোনো ফল ফেরায়নি")
            val responseParts = candidates.optJSONObject(0)?.optJSONObject("content")?.optJSONArray("parts") ?: JSONArray()
            val text = (0 until responseParts.length()).mapNotNull {
                responseParts.optJSONObject(it)?.optString("text")?.takeIf(String::isNotBlank)
            }.joinToString("\n")
            return VisionAnalysisResult(text.takeIf(String::isNotBlank) ?: throw IllegalStateException("AI response খালি"), "Google Gemini", MODEL)
        } finally {
            connection.disconnect()
        }
    }

    private const val MAX_IMAGE_BYTES = 4 * 1024 * 1024
    private const val MODEL = "gemini-2.5-flash"
    private const val ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/$MODEL:generateContent"
    private const val PROMPT = "Analyze this Android screenshot for a user-directed phone automation assistant. Respond in Bengali. Identify the visible app and screen state, read visible UI labels, explain what is happening, suggest the next safe action, mention uncertainty, and flag destructive or sensitive controls that require explicit confirmation. Do not claim to have changed anything."
}
