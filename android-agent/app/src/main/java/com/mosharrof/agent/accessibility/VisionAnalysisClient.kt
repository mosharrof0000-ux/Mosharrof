package com.mosharrof.agent.accessibility

import android.graphics.Bitmap
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import android.util.Base64

/** Uses the existing MOSHARROF chat Worker; no API key is embedded in the Android app. */
object VisionAnalysisClient {
    private const val ENDPOINT = "https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/chat"
    private const val MAX_EDGE = 1280

    data class Result(val text: String, val provider: String?, val model: String?)

    fun analyze(bitmap: Bitmap, callback: (Result?, String?) -> Unit) {
        Thread {
            try {
                val image = encodeBoundedJpeg(bitmap)
                val body = JSONObject()
                    .put("text", "এই Android স্ক্রিনশটটি বাংলায় বুদ্ধিমত্তার সঙ্গে বিশ্লেষণ করুন। স্ক্রিনে কী আছে, গুরুত্বপূর্ণ লেখা/বোতাম, ব্যবহারকারীর সম্ভাব্য লক্ষ্য এবং পরবর্তী নিরাপদ পদক্ষেপ জানান। অনুমানকে নিশ্চিত তথ্য হিসেবে বলবেন না। কোনো বোতাম চাপবেন না; শুধু বিশ্লেষণ দিন।")
                    .put("image", "data:image/jpeg;base64,$image")
                    .put("image_name", "mosharrof-android-screen.jpg")
                    .put("stream_status", false)
                    .toString()
                val connection = (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 15000
                    readTimeout = 45000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    setRequestProperty("Accept", "application/json")
                }
                try {
                    connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                    val status = connection.responseCode
                    val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                    val response = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText().take(200_000) }.orEmpty()
                    val json = runCatching { JSONObject(response) }.getOrNull()
                    if (status !in 200..299) {
                        callback(null, json?.optString("provider_message")?.takeIf { it.isNotBlank() }
                            ?: json?.optString("message")?.takeIf { it.isNotBlank() }
                            ?: json?.optString("error")?.takeIf { it.isNotBlank() }
                            ?: "MOSHARROF vision service HTTP $status")
                    } else {
                        val text = json?.optString("text").orEmpty().trim()
                        if (text.isBlank()) callback(null, "AI vision service খালি উত্তর দিয়েছে।")
                        else callback(Result(text, json?.optString("provider"), json?.optString("model")), null)
                    }
                } finally {
                    connection.disconnect()
                }
            } catch (error: Exception) {
                callback(null, "স্ক্রিন বিশ্লেষণ সংযোগ ব্যর্থ: ${error.message ?: "অজানা ত্রুটি"}")
            }
        }.start()
    }

    private fun encodeBoundedJpeg(source: Bitmap): String {
        val scale = minOf(1.0, MAX_EDGE.toDouble() / maxOf(source.width, source.height))
        val bounded = if (scale < 1.0) Bitmap.createScaledBitmap(
            source, (source.width * scale).toInt().coerceAtLeast(1),
            (source.height * scale).toInt().coerceAtLeast(1), true
        ) else source
        return try {
            val bytes = ByteArrayOutputStream()
            check(bounded.compress(Bitmap.CompressFormat.JPEG, 76, bytes)) { "JPEG compression failed" }
            Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)
        } finally {
            if (bounded !== source) bounded.recycle()
        }
    }
}
