package com.mosharrof.agent.vision

import android.graphics.Bitmap
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Executors

/** Explicitly invoked Gemini vision request; screenshot bytes are sent only after UI consent. */
object GeminiVisionAnalyzer {
    private val executor = Executors.newSingleThreadExecutor()
    fun analyze(bitmap: Bitmap, apiKey: String, callback: (String) -> Unit) {
        executor.execute {
            val result = runCatching { request(bitmap, apiKey) }
                .getOrElse { "AI স্ক্রিন বিশ্লেষণ ব্যর্থ: ${it.message ?: "নেটওয়ার্ক বা API ত্রুটি"}" }
            callback(result)
        }
    }

    private fun request(bitmap: Bitmap, apiKey: String): String {
        val bytes = ByteArrayOutputStream().use { output ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, 78, output)
            output.toByteArray()
        }
        require(bytes.size <= MAX_IMAGE_BYTES) { "ছবিটি API সীমার চেয়ে বড়; স্ক্রিনশট ছোট করে আবার চেষ্টা করুন।" }
        val parts = JSONArray()
            .put(JSONObject().put("text", PROMPT))
            .put(JSONObject().put("inline_data", JSONObject()
                .put("mime_type", "image/jpeg")
                .put("data", Base64.encodeToString(bytes, Base64.NO_WRAP))))
        val payload = JSONObject()
            .put("contents", JSONArray().put(JSONObject().put("parts", parts)))
            .put("generationConfig", JSONObject().put("temperature", 0.2).put("maxOutputTokens", 700))
        val encodedKey = URLEncoder.encode(apiKey, Charsets.UTF_8.name())
        val connection = (URL("$ENDPOINT?key=$encodedKey").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 35_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
        }
        try {
            connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (code !in 200..299) {
                val detail = runCatching { JSONObject(body).optJSONObject("error")?.optString("message") }.getOrNull()
                throw IllegalStateException("Gemini HTTP $code: ${detail?.take(240).orEmpty().ifBlank { "অনুরোধ গ্রহণ হয়নি" }}")
            }
            val root = JSONObject(body)
            val candidates = root.optJSONArray("candidates") ?: throw IllegalStateException("AI কোনো বিশ্লেষণ ফেরায়নি")
            val candidate = candidates.optJSONObject(0) ?: throw IllegalStateException("AI response খালি")
            val responseParts = candidate.optJSONObject("content")?.optJSONArray("parts") ?: JSONArray()
            val text = (0 until responseParts.length()).mapNotNull { responseParts.optJSONObject(it)?.optString("text") }
                .filter { it.isNotBlank() }.joinToString("\n")
            text.takeIf { it.isNotBlank() } ?: throw IllegalStateException("AI বিশ্লেষণের লেখা পাওয়া যায়নি")
        } finally {
            connection.disconnect()
        }
    }

    private const val MAX_IMAGE_BYTES = 4 * 1024 * 1024
    private const val ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    private const val PROMPT = "Analyze this Android screenshot for a user-directed phone automation assistant. Respond in Bengali. Describe the visible app/screen, readable UI labels, current state, likely next safe actions, uncertainty, and any sensitive or destructive controls that require explicit confirmation. Do not claim to have clicked or changed anything. Return concise structured observations."
}
