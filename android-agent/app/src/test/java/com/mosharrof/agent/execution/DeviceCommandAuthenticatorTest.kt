package com.mosharrof.agent.execution

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeviceCommandAuthenticatorTest {
    private val secret = ByteArray(32) { (it + 1).toByte() }
    private val now = 1_800_000_000_000L

    @Test fun acceptsValidSignedCommandOnce() {
        val verifier = DeviceCommandAuthenticator()
        val request = signed()
        assertEquals(DeviceCommandRejection.NONE, verifier.verify(request, secret, now).rejection)
        assertEquals(DeviceCommandRejection.REPLAYED_NONCE, verifier.verify(request, secret, now).rejection)
    }

    @Test fun rejectsModifiedPayloadAndWrongSecret() {
        val verifier = DeviceCommandAuthenticator()
        val request = signed()
        assertEquals(
            DeviceCommandRejection.INVALID_SIGNATURE,
            verifier.verify(request.copy(target = "com.example.other"), secret, now).rejection
        )
        assertEquals(
            DeviceCommandRejection.INVALID_SIGNATURE,
            verifier.verify(request, ByteArray(32) { 9 }, now).rejection
        )
    }

    @Test fun rejectsExpiredFutureAndExcessivelyLongRequests() {
        val verifier = DeviceCommandAuthenticator()
        assertEquals(DeviceCommandRejection.EXPIRED_OR_FUTURE, verifier.verify(signed(expiry = now - 1), secret, now).rejection)
        assertEquals(DeviceCommandRejection.EXPIRED_OR_FUTURE, verifier.verify(signed(issued = now + 60_000), secret, now).rejection)
        assertEquals(DeviceCommandRejection.EXPIRED_OR_FUTURE, verifier.verify(signed(expiry = now + 20 * 60_000), secret, now).rejection)
    }

    @Test fun rejectsWeakSecretAndMalformedEnvelope() {
        val verifier = DeviceCommandAuthenticator()
        assertEquals(DeviceCommandRejection.INVALID_SECRET, verifier.verify(signed(), ByteArray(8), now).rejection)
        assertEquals(DeviceCommandRejection.MALFORMED_ENVELOPE, verifier.verify(signed().copy(requestId = "bad id"), secret, now).rejection)
    }

    @Test fun invalidSignatureDoesNotConsumeNonce() {
        val verifier = DeviceCommandAuthenticator()
        val request = signed()
        assertFalse(verifier.verify(request.copy(signatureHex = "0".repeat(64)), secret, now).accepted)
        assertTrue(verifier.verify(request, secret, now).accepted)
    }

    @Test fun actionTargetsMustMatchTheAllowlistedAction() {
        val verifier = DeviceCommandAuthenticator()
        val invalidUninstall = signed().copy(target = "YouTube")
        assertEquals(
            DeviceCommandRejection.MALFORMED_ENVELOPE,
            verifier.verify(invalidUninstall, secret, now).rejection
        )
        val installWithPath = signed().copy(action = DeviceCommandAction.INSTALL_APK, target = "/sdcard/app.apk")
        assertEquals(
            DeviceCommandRejection.MALFORMED_ENVELOPE,
            verifier.verify(installWithPath, secret, now).rejection
        )
    }

    @Test fun nonceCacheCapacityFailsClosedInsteadOfEvictingLiveNonces() {
        val verifier = DeviceCommandAuthenticator(maxRememberedNonces = 1)
        val first = signed(nonce = "nonce-first-12345")
        val second = signed(nonce = "nonce-second-1234")
        assertTrue(verifier.verify(first, secret, now).accepted)
        assertEquals(
            DeviceCommandRejection.NONCE_CAPACITY_REACHED,
            verifier.verify(second, secret, now).rejection
        )
        assertEquals(
            DeviceCommandRejection.REPLAYED_NONCE,
            verifier.verify(first, secret, now).rejection
        )
    }

    private fun signed(
        issued: Long = now,
        expiry: Long = now + 60_000,
        nonce: String = "nonce-0123456789"
    ): DeviceCommandEnvelope {
        val unsigned = DeviceCommandEnvelope(
            requestId = "req-42",
            action = DeviceCommandAction.UNINSTALL_APP,
            issuedAtMillis = issued,
            expiresAtMillis = expiry,
            nonce = nonce,
            target = "com.example.target",
            signatureHex = "0".repeat(64)
        )
        return unsigned.copy(signatureHex = DeviceCommandAuthenticator.sign(secret, unsigned.canonicalPayload()))
    }
}
