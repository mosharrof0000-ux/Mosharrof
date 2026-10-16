package com.mosharrof.agent.accessibility

import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.util.Base64
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import kotlin.math.min

data class VisionAnalysisResult(val ok: Boolean, val message: String)

/** Sends a screenshot only after the user taps AI analysis; no API key is stored in the APK. */
internal object ScreenshotVisionClient {
    private const val ENDPOINT = "https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/"
    private const val MAX_UPLOAD_BYTES = 10 * 1024 * 1024
    private const val MAX_RESPONSE_BYTES = 1024 * 1024
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    fun analyze(bitmap: Bitmap, callback: (VisionAnalysisResult) -> Unit) {
        executor.execute {
            val result = runCatching { requestAnalysis(bitmap) }.getOrElse {
                VisionAnalysisResult(false, "AI vision সার্ভারে সংযোগ করা যায়নি: ${it.message ?: "নেটওয়ার্ক ত্রুটি"}")
            }
            mainHandler.post { callback(result) }
        }
    }

    private fun requestAnalysis(bitmap: Bitmap): VisionAnalysisResult {
        val maxDimension = maxOf(bitmap.width, bitmap.height)
        val scale = min(1f, 1280f / maxDimension)
        val resized = if (scale < 1f) Bitmap.createScaledBitmap(
            bitmap, (bitmap.width * scale).toInt().coerceAtLeast(1),
            (bitmap.height * scale).toInt().coerceAtLeast(1), true
        ) else bitmap
        val bytes = try {
            ByteArrayOutputStream().use { output ->
                if (!resized.compress(Bitmap.CompressFormat.JPEG, 78, output)) {
                    throw IllegalStateException("ছবি JPEG-এ রূপান্তর করা যায়নি।")
                }
                output.toByteArray()
            }
        } finally {
            if (resized !== bitmap) resized.recycle()
        }
        if (bytes.isEmpty() || bytes.size > MAX_UPLOAD_BYTES) {
            return VisionAnalysisResult(false, "ছবির আকার অনুমোদিত সীমার বাইরে; ছবি পাঠানো হয়নি।")
        }
        val body = JSONObject()
            .put("image_base64", Base64.encodeToString(bytes, Base64.NO_WRAP))
            .put("mime_type", "image/jpeg")
            .put("prompt", "Analyze this Android app screenshot in Bengali. Describe the current screen, visible controls and text, likely user intent, errors, and safe next actions. Separate observed facts from guesses. Do not claim an action was performed.")
            .toString().toByteArray(Charsets.UTF_8)
        val connection = (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15000
            readTimeout = 45000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Accept", "application/json")
        }
        return try {
            connection.outputStream.use { it.write(body) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                var total = 0
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    total += count
                    if (total > MAX_RESPONSE_BYTES) throw IllegalStateException("AI response too large")
                    output.write(buffer, 0, count)
                }
                output.toString(Charsets.UTF_8.name())
            }.orEmpty()
            if (code !in 200..299) {
                val detail = runCatching { JSONObject(response).optString("error") }.getOrNull().orEmpty()
                VisionAnalysisResult(false, "AI vision সার্ভার HTTP $code দিয়েছে${if (detail.isBlank()) "" else ": $detail"}।")
            } else {
                val json = JSONObject(response)
                val text = json.optString("text").trim()
                val model = json.optString("model", "vision model")
                if (json.optBoolean("ok") && text.isNotBlank()) {
                    VisionAnalysisResult(true, "মডেল: $model\n\n$text")
                } else {
                    VisionAnalysisResult(false, "সার্ভার থেকে বিশ্লেষণ পাওয়া যায়নি: ${json.optString("error", "empty_response")}")
                }
            }
        } finally {
            connection.disconnect()
        }
    }
}
