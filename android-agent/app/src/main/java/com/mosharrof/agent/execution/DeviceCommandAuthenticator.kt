package com.mosharrof.agent.execution

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/** Allowlisted, signed command envelope for a future paired-device transport. */
enum class DeviceCommandAction {
    INSTALL_APK,
    SEARCH_PLAY_STORE,
    UNINSTALL_APP
}

data class DeviceCommandEnvelope(
    val requestId: String,
    val action: DeviceCommandAction,
    val issuedAtMillis: Long,
    val expiresAtMillis: Long,
    val nonce: String,
    val target: String,
    val signatureHex: String
) {
    /** Canonical representation is deliberately versioned and length-bounded. */
    fun canonicalPayload(): String = listOf(
        "mosharrof-device-command-v1",
        requestId,
        action.name,
        issuedAtMillis.toString(),
        expiresAtMillis.toString(),
        nonce,
        target
    ).joinToString("\n")
}

enum class DeviceCommandRejection {
    NONE,
    INVALID_SECRET,
    MALFORMED_ENVELOPE,
    EXPIRED_OR_FUTURE,
    INVALID_SIGNATURE,
    REPLAYED_NONCE,
    NONCE_CAPACITY_REACHED
}

data class DeviceCommandVerification(
    val accepted: Boolean,
    val rejection: DeviceCommandRejection
)

/**
 * Transport-independent fail-closed verification. The caller must supply a per-device
 * secret obtained from an authenticated pairing flow (never from the command itself).
 * This class does not execute commands or persist secrets.
 */
class DeviceCommandAuthenticator(
    private val maxClockSkewMillis: Long = 30_000,
    private val maxLifetimeMillis: Long = 5 * 60_000L,
    private val maxRememberedNonces: Int = 2_000
) {
    private val seenNonces = LinkedHashMap<String, Long>()

    init {
        require(maxClockSkewMillis in 0..120_000)
        require(maxLifetimeMillis in 1_000..10 * 60_000L)
        require(maxRememberedNonces in 1..10_000)
    }

    @Synchronized
    fun verify(
        envelope: DeviceCommandEnvelope,
        deviceSecret: ByteArray,
        nowMillis: Long
    ): DeviceCommandVerification {
        if (deviceSecret.size < 32) return reject(DeviceCommandRejection.INVALID_SECRET)
        if (!isWellFormed(envelope)) return reject(DeviceCommandRejection.MALFORMED_ENVELOPE)
        if (nowMillis < 0 || envelope.issuedAtMillis < 0 || envelope.expiresAtMillis < 0 ||
            envelope.issuedAtMillis > nowMillis + maxClockSkewMillis ||
            envelope.expiresAtMillis < nowMillis ||
            envelope.expiresAtMillis <= envelope.issuedAtMillis ||
            envelope.expiresAtMillis - envelope.issuedAtMillis > maxLifetimeMillis
        ) return reject(DeviceCommandRejection.EXPIRED_OR_FUTURE)

        prune(nowMillis)
        if (seenNonces.containsKey(envelope.nonce)) return reject(DeviceCommandRejection.REPLAYED_NONCE)

        val expected = hmacSha256(deviceSecret, envelope.canonicalPayload())
        val supplied = decodeHex(envelope.signatureHex) ?: return reject(DeviceCommandRejection.INVALID_SIGNATURE)
        if (!MessageDigest.isEqual(expected, supplied)) return reject(DeviceCommandRejection.INVALID_SIGNATURE)

        // Fail closed at capacity: evicting a live nonce would permit a replay.
        if (seenNonces.size >= maxRememberedNonces) {
            return reject(DeviceCommandRejection.NONCE_CAPACITY_REACHED)
        }
        seenNonces[envelope.nonce] = envelope.expiresAtMillis
        return DeviceCommandVerification(true, DeviceCommandRejection.NONE)
    }

    private fun isWellFormed(e: DeviceCommandEnvelope): Boolean {
        val commonFieldsValid =
            e.requestId.length in 1..128 &&
                e.requestId.all { it.isLetterOrDigit() || it in "-_." } &&
                e.nonce.length in 16..128 &&
                e.nonce.all { it.isLetterOrDigit() || it in "-_." } &&
                e.target.length <= 200 &&
                e.target.none { it.isISOControl() } &&
                e.signatureHex.length == 64 &&
                e.signatureHex.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }
        if (!commonFieldsValid) return false
        return when (e.action) {
            DeviceCommandAction.INSTALL_APK -> e.target.isBlank()
            DeviceCommandAction.SEARCH_PLAY_STORE -> e.target.isNotBlank() && e.target.trim().length <= 120
            DeviceCommandAction.UNINSTALL_APP -> PACKAGE_NAME.matches(e.target)
        }
    }

    private fun prune(nowMillis: Long) {
        val iterator = seenNonces.entries.iterator()
        while (iterator.hasNext()) {
            if (iterator.next().value < nowMillis) iterator.remove()
        }
    }

    private fun reject(reason: DeviceCommandRejection) = DeviceCommandVerification(false, reason)

    companion object {
        private val PACKAGE_NAME = Regex("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+")

        /** Signing helper for the trusted paired client; callers must protect the key. */
        fun sign(secret: ByteArray, canonicalPayload: String): String =
            hmacSha256(secret, canonicalPayload).joinToString("") { "%02x".format(it) }

        private fun hmacSha256(secret: ByteArray, value: String): ByteArray {
            val mac = Mac.getInstance("HmacSHA256")
            mac.init(SecretKeySpec(secret, "HmacSHA256"))
            return mac.doFinal(value.toByteArray(StandardCharsets.UTF_8))
        }

        private fun decodeHex(value: String): ByteArray? {
            if (value.length != 64 || value.any { it !in '0'..'9' && it !in 'a'..'f' && it !in 'A'..'F' }) return null
            return runCatching {
                ByteArray(value.length / 2) { index ->
                    value.substring(index * 2, index * 2 + 2).toInt(16).toByte()
                }
            }.getOrNull()
        }
    }
}
