package com.mosharrof.agent.execution

import android.content.Context
import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties

/** Stores the shared pairing secret encrypted by a non-exportable Android Keystore AES key. */
object DevicePairingSecretStore {
    private const val PREFS = "mosharrof_device_pairing"
    private const val KEY_IV = "secret_iv"
    private const val KEY_CIPHERTEXT = "secret_ciphertext"
    private const val ANDROID_KEY_ALIAS = "mosharrof_device_pairing_aes_v1"

    @Synchronized
    fun getOrCreateSecretBase64(context: Context, rotate: Boolean = false): String {
        if (!rotate) loadSecret(context)?.let { return Base64.encodeToString(it, Base64.NO_WRAP) }
        val secret = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateEncryptionKey())
        val encrypted = cipher.doFinal(secret)
        val saved = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_IV, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .putString(KEY_CIPHERTEXT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .commit()
        check(saved) { "Unable to persist the encrypted pairing secret" }
        return Base64.encodeToString(secret, Base64.NO_WRAP)
    }

    @Synchronized
    fun loadSecret(context: Context): ByteArray? = runCatching {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val iv = prefs.getString(KEY_IV, null)?.let { Base64.decode(it, Base64.NO_WRAP) } ?: return null
        val encrypted = prefs.getString(KEY_CIPHERTEXT, null)?.let { Base64.decode(it, Base64.NO_WRAP) } ?: return null
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateEncryptionKey(), GCMParameterSpec(128, iv))
        cipher.doFinal(encrypted).takeIf { it.size == 32 }
    }.getOrNull()

    @Synchronized
    fun revoke(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().commit()
        runCatching {
            val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
            store.deleteEntry(ANDROID_KEY_ALIAS)
        }
    }

    private fun getOrCreateEncryptionKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(ANDROID_KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                ANDROID_KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }
}

/** Adds process-restart replay protection to the in-memory envelope verifier. */
object DeviceCommandReplayStore {
    private const val PREFS = "mosharrof_device_command_replay"
    private const val NONCE_PREFIX = "nonce_"

    @Synchronized
    fun verifyAndRemember(
        context: Context,
        authenticator: DeviceCommandAuthenticator,
        envelope: DeviceCommandEnvelope,
        secret: ByteArray,
        nowMillis: Long
    ): DeviceCommandVerification {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val nonceKey = NONCE_PREFIX + sha256Hex(envelope.nonce)
        val editor = prefs.edit()
        prefs.all.forEach { (key, value) ->
            if (key.startsWith(NONCE_PREFIX) && value is Long && value < nowMillis) editor.remove(key)
        }
        editor.apply()
        if (prefs.contains(nonceKey)) {
            return DeviceCommandVerification(false, DeviceCommandRejection.REPLAYED_NONCE)
        }
        val result = authenticator.verify(envelope, secret, nowMillis)
        if (result.accepted && !prefs.edit().putLong(nonceKey, envelope.expiresAtMillis).commit()) {
            // Revoke the pairing secret so a process restart cannot accept this command as fresh.
            DevicePairingSecretStore.revoke(context)
            return DeviceCommandVerification(false, DeviceCommandRejection.REPLAY_STATE_NOT_PERSISTED)
        }
        return result
    }

    private fun sha256Hex(value: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(StandardCharsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
}
