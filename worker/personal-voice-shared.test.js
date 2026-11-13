import test from "node:test";
import assert from "node:assert/strict";
import { decryptSample, decryptText, encryptSample, encryptText } from "../organs/personal-voice/worker/shared.js";

const env = { PERSONAL_VOICE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") };

test("encrypted voice samples round-trip with the versioned AES-GCM envelope", async () => {
  const original = new TextEncoder().encode("private Bengali voice reference");
  const encrypted = await encryptSample(original, env);
  assert.equal(encrypted[0], 1);
  assert.notDeepEqual([...encrypted], [...original]);
  const restored = await decryptSample(encrypted, env);
  assert.deepEqual([...restored], [...original]);
});

test("voice sample envelope rejects unknown versions and tampering", async () => {
  const encrypted = await encryptSample(new Uint8Array([1, 2, 3]), env);
  const unsupported = encrypted.slice();
  unsupported[0] = 2;
  await assert.rejects(() => decryptSample(unsupported, env), /voice_sample_version_unsupported/);
  const tampered = encrypted.slice();
  tampered[tampered.length - 1] ^= 1;
  await assert.rejects(() => decryptSample(tampered, env), /voice_sample_authentication_failed/);
});

test("voice sample encryption refuses missing or malformed keys", async () => {
  await assert.rejects(() => encryptSample(new Uint8Array([1]), {}), /voice_encryption_not_configured/);
  await assert.rejects(() => decryptSample(new Uint8Array(40), {}), /voice_sample_unavailable/);
});

test("reference transcripts are encrypted at rest and authenticated before inference", async () => {
  const transcript = "আমার কণ্ঠের নমুনা বাক্য";
  const ciphertext = await encryptText(transcript, env);
  assert.match(ciphertext, /^enc:v1:/);
  assert.equal(ciphertext.includes(transcript), false);
  assert.equal(await decryptText(ciphertext, env), transcript);
  await assert.rejects(() => decryptText(transcript, env), /voice_reference_text_unavailable/);
});
