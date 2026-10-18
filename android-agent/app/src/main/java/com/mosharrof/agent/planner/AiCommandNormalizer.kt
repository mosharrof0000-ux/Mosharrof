package com.mosharrof.agent.planner

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** AI may normalize a request, but every result is re-parsed by the deterministic local planner. */
object AiCommandNormalizer {
    private const val ENDPOINT = "https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/chat"

    data class Result(val normalizedCommand: String?, val explanation: String)

    fun resolve(
        request: String,
        installedAppLabels: List<String>,
        callback: (Result?, String?) -> Unit
    ) {
        if (request.isBlank() || request.length > 1000) {
            callback(null, "কমান্ডটি খালি বা ১০০০ অক্ষরের বেশি।")
            return
        }
        Thread {
            try {
                val apps = installedAppLabels.distinct().take(100).joinToString(", ") { it.take(60) }
                val prompt = """
                    You are the Bengali-first command normalizer for MOSHARROF Android.
                    Convert the user's request into ONE command supported by the local parser, or mark unsupported.
                    Installed app labels (use only these exact labels for app targets): $apps
                    Allowed normalized command forms:
                    - open <exact installed app label>
                    - go back | go home | open notifications | open recent apps
                    - open settings | open wifi settings | open bluetooth settings | open location settings
                    - open display settings | open sound settings | open battery saver settings | open notification settings | open app settings
                    - tap "<exact visible label>" in "<exact app label>"
                    - type "<text up to 160 chars>" in "<exact app label>"
                    - scroll up|down|left|right in "<exact app label>"
                    - call <phone number> (only opens dialer; never place a call)
                    - sms <phone number> <message> (only compose a draft; never send)
                    - timer <duration> minutes|seconds|hours
                    - calendar <short event title> (only opens a draft)
                    Rules: never output shell, ADB, root, code, arbitrary URLs, hidden API calls, or destructive commands.
                    Never invent an installed app. Never normalize a request to send/delete/pay/share/post/install/uninstall or change security settings.
                    If the request needs unsupported actions or clarification, return supported=false.
                    Return only JSON: {"supported":true,"normalized_command":"...","explanation":"short Bengali explanation"}
                    or {"supported":false,"normalized_command":"","explanation":"why unsupported/what clarification is needed"}.
                    User request: ${request.take(1000)}
                """.trimIndent()
                val body = JSONObject().put("text", prompt).put("image", JSONObject.NULL)
                    .put("image_name", JSONObject.NULL).put("stream_status", false).toString()
                val connection = (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 12000
                    readTimeout = 45000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    setRequestProperty("Accept", "application/json")
                }
                try {
                    connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                    val status = connection.responseCode
                    val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                    val raw = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText().take(100_000) }.orEmpty()
                    val envelope = runCatching { JSONObject(raw) }.getOrNull()
                    if (status !in 200..299) {
                        callback(null, envelope?.optString("message")?.takeIf { it.isNotBlank() }
                            ?: envelope?.optString("error")?.takeIf { it.isNotBlank() }
                            ?: "AI command service HTTP $status")
                    } else {
                        val text = envelope?.optString("text").orEmpty()
                        val first = text.indexOf('{')
                        val last = text.lastIndexOf('}')
                        val json = if (first >= 0 && last > first) runCatching {
                            JSONObject(text.substring(first, last + 1))
                        }.getOrNull() else null
                        if (json == null || !json.optBoolean("supported", false)) {
                            callback(Result(null, json?.optString("explanation").orEmpty().ifBlank {
                                "AI একটি যাচাইযোগ্য সমর্থিত কমান্ড দিতে পারেনি।"
                            }), null)
                        } else {
                            val normalized = json.optString("normalized_command").trim()
                            if (normalized.isBlank() || normalized.length > 240) {
                                callback(Result(null, "AI-এর প্রস্তাব খালি বা সীমার বাইরে।"), null)
                            } else callback(Result(normalized, json.optString("explanation").take(300)), null)
                        }
                    }
                } finally {
                    connection.disconnect()
                }
            } catch (error: Exception) {
                callback(null, "AI command সহায়তা সংযোগ ব্যর্থ: ${error.message ?: "অজানা ত্রুটি"}")
            }
        }.start()
    }
}
