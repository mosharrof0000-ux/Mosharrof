import test from "node:test";
import assert from "node:assert/strict";
import { isVoiceEnrollmentValid } from "../components/personal-voice-menu-profiles.js";

test("voice enrollment requires name, transcript, audio and both mandatory consents", () => {
  const file = { size: 1024 };
  assert.equal(isVoiceEnrollmentValid({ name: "আমার কণ্ঠ", transcript: "নমুনা বাক্য", file, voiceConsent: true, storageConsent: true }), true);
  assert.equal(isVoiceEnrollmentValid({ name: "আমার কণ্ঠ", transcript: "নমুনা বাক্য", file, voiceConsent: false, storageConsent: true }), false);
  assert.equal(isVoiceEnrollmentValid({ name: "আমার কণ্ঠ", transcript: "নমুনা বাক্য", file, voiceConsent: true, storageConsent: false }), false);
  assert.equal(isVoiceEnrollmentValid({ name: "আমার কণ্ঠ", transcript: "", file, voiceConsent: true, storageConsent: true }), false);
  assert.equal(isVoiceEnrollmentValid({ name: "আমার কণ্ঠ", transcript: "নমুনা বাক্য", file: { size: 0 }, voiceConsent: true, storageConsent: true }), false);
});
