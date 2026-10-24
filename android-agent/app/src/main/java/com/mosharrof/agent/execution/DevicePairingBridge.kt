package com.mosharrof.agent.execution

import android.content.Context
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.SecureRandom
import java.util.UUID

/** HTTPS transport client for the explicitly paired, foreground Android agent. */
object DevicePairingBridge {
    private const val API = "https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/device"
    private const val PREFS = "mosharrof_device_remote_task"
    private const val KEY_REQUEST_ID = "request_id"
    private const val KEY_ACTION = "action"
    private const val KEY_TARGET = "target"
    private const val KEY_EXPIRY = "expiry"
    private const val KEY_RESULT = "result_json"
    private val authenticator = DeviceCommandAuthenticator()
    private val random = SecureRandom()

    data class PairingStart(val deviceId: String, val pairingCode: String?, val alreadyPaired: Boolean)
    data class PollOutcome(
        val paired: Boolean,
        val command: DeviceCommandEnvelope? = null,
        val rejected: DeviceCommandEnvelope? = null
    )
    data class RemotePending(
        val requestId: String,
        val action: AppPackageTaskAction,
        val target: String,
        val expiresAtMillis: Long
    )

    @Synchronized
    fun startPairing(context: Context): PairingStart {
        val old = DevicePairingSecretStore.load(context)
        if (old != null) {
            val current = runCatching { api("GET", "/pair/status", old.secretHex) }.getOrNull()
            if (current?.optBoolean("paired", false) == true) {
                return PairingStart(old.deviceId, null, alreadyPaired = true)
            }
        }
        val deviceId = old?.deviceId ?: UUID.randomUUID().toString()
        val secret = randomHex(32)
        val code = random.nextInt(1_000_000).toString().padStart(6, '0')
        DevicePairingSecretStore.save(context, deviceId, secret)
        return try {
            api(
                "POST", "/pair/start", null,
                JSONObject().put("deviceId", deviceId).put("pairingCode", code).put("deviceSecret", secret)
            )
            PairingStart(deviceId, code, alreadyPaired = false)
        } catch (error: Exception) {
            if (old != null) DevicePairingSecretStore.save(context, old.deviceId, old.secretHex)
            else DevicePairingSecretStore.clear(context)
            throw error
        }
    }

    fun poll(context: Context): PollOutcome? {
        val credentials = DevicePairingSecretStore.load(context) ?: return null
        return try {
            val status = api("GET", "/pair/status", credentials.secretHex)
            if (!status.optBoolean("paired", false)) return PollOutcome(paired = false)
            val response = api("GET", "/poll", credentials.secretHex)
            val value = response.optJSONObject("command") ?: return PollOutcome(paired = true)
            val envelope = parseEnvelope(value) ?: return PollOutcome(paired = true)
            val verification = authenticator.verify(envelope, fromHex(credentials.secretHex), System.currentTimeMillis())
            if (verification.accepted) PollOutcome(paired = true, command = envelope)
            else PollOutcome(paired = true, rejected = envelope)
        } catch (_: Exception) {
            null
        }
    }

    fun hasCredentials(context: Context): Boolean = DevicePairingSecretStore.load(context) != null

    fun isRemoteCommandExpired(context: Context): Boolean =
        pendingRemote(context)?.expiresAtMillis?.let { it <= System.currentTimeMillis() } == true

    fun savePendingRemote(context: Context, envelope: DeviceCommandEnvelope): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val current = prefs.getString(KEY_REQUEST_ID, null)
        if (current != null && current != envelope.requestId) return false
        prefs.edit()
            .putString(KEY_REQUEST_ID, envelope.requestId)
            .putString(KEY_ACTION, envelope.action.name)
            .putString(KEY_TARGET, envelope.target)
            .putLong(KEY_EXPIRY, envelope.expiresAtMillis)
            .apply()
        return true
    }

    fun pendingRemote(context: Context): RemotePending? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val requestId = prefs.getString(KEY_REQUEST_ID, null) ?: return null
        val action = runCatching {
            AppPackageTaskAction.valueOf(prefs.getString(KEY_ACTION, null) ?: return null)
        }.getOrNull() ?: return null
        return RemotePending(
            requestId, action, prefs.getString(KEY_TARGET, "") ?: "",
            prefs.getLong(KEY_EXPIRY, 0L)
        )
    }

    fun recordRemoteResult(context: Context, localResult: AppPackageTaskResult) {
        val pending = pendingRemote(context) ?: return
        if (pending.action != localResult.action) return
        val body = JSONObject()
            .put("requestId", pending.requestId)
            .put("action", pending.action.name)
            .put("status", localResult.status.name)
            .put("detail", localResult.detail.take(500))
            .put("packageName", localResult.packageName ?: JSONObject.NULL)
            .put("packageStateVerified", localResult.packageStateVerified)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_RESULT, body.toString()).apply()
        Thread { flushPendingResult(context.applicationContext) }.start()
    }

    fun flushPendingResult(context: Context) {
        val credentials = DevicePairingSecretStore.load(context) ?: return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val pending = pendingRemote(context) ?: return
        val raw = prefs.getString(KEY_RESULT, null) ?: return
        try {
            val result = JSONObject(raw)
            val response = api("POST", "/result", credentials.secretHex, result)
            if (response.optBoolean("accepted", false) && response.optBoolean("terminal", false)) {
                clearPendingRemote(context)
            } else if (pending.expiresAtMillis <= System.currentTimeMillis()) {
                val timedOut = JSONObject()
                    .put("requestId", pending.requestId)
                    .put("action", pending.action.name)
                    .put("status", "TIMED_OUT")
                    .put("detail", "ফোনের কাজের মেয়াদ শেষ হয়েছে; ফলাফল নিশ্চিত নয়।")
                    .put("packageName", JSONObject.NULL)
                    .put("packageStateVerified", false)
                prefs.edit().putString(KEY_RESULT, timedOut.toString()).apply()
                runCatching {
                    val timeoutResponse = api("POST", "/result", credentials.secretHex, timedOut)
                    if (timeoutResponse.optBoolean("terminal", false)) clearPendingRemote(context)
                }
            }
        } catch (_: Exception) {
            // Keep the correlated result for retry on the next foreground poll.
        }
    }

    fun clearPendingRemote(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .remove(KEY_REQUEST_ID).remove(KEY_ACTION).remove(KEY_TARGET)
            .remove(KEY_EXPIRY).remove(KEY_RESULT).apply()
    }

    private fun parseEnvelope(value: JSONObject): DeviceCommandEnvelope? = runCatching {
        DeviceCommandEnvelope(
            requestId = value.getString("requestId"),
            action = DeviceCommandAction.valueOf(value.getString("action")),
            issuedAtMillis = value.getLong("issuedAtMillis"),
            expiresAtMillis = value.getLong("expiresAtMillis"),
            nonce = value.getString("nonce"),
            target = value.getString("target"),
            signatureHex = value.getString("signatureHex")
        )
    }.getOrNull()

    private fun api(
        method: String,
        path: String,
        token: String? = null,
        body: JSONObject? = null
    ): JSONObject {
        val connection = (URL(API + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 8_000
            readTimeout = 8_000
            setRequestProperty("Accept", "application/json")
            if (token != null) setRequestProperty("Authorization", "Bearer $token")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            if (body != null) connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = runCatching { JSONObject(response) }.getOrElse { JSONObject() }
            if (code !in 200..299 || json.optBoolean("ok", true).not()) {
                throw IOException(json.optString("error").ifBlank { "HTTP $code" })
            }
            return json
        } finally {
            connection.disconnect()
        }
    }

    private fun randomHex(size: Int): String {
        val bytes = ByteArray(size)
        random.nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private fun fromHex(value: String): ByteArray =
        ByteArray(value.length / 2) { index ->
            value.substring(index * 2, index * 2 + 2).toInt(16).toByte()
        }
}
