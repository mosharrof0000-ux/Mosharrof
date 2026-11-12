import test from "node:test";
import assert from "node:assert/strict";
import {
  assertNeverReuseSerial,
  canUseVoiceProfile,
  createVoiceProfileDraft,
  normalizeVoiceProfile
} from "../domain/profile.js";

test("draft requires separate explicit voice-use and sample-storage consent", () => {
  assert.throws(() => createVoiceProfileDraft({ name: "আমার কণ্ঠ" }), /consent_required/);
  const draft = createVoiceProfileDraft({
    name: "আমার কণ্ঠ",
    consent: { voice_use: true, sample_storage: true, model_training: false }
  });
  assert.equal(draft.serial, null);
  assert.equal(draft.consent.model_training, false);
});

test("profile normalization rejects malformed serials and unknown states", () => {
  const profile = normalizeVoiceProfile({ name: "বাংলা", serial: "VOICE-X", status: "unknown" });
  assert.equal(profile.serial, null);
  assert.equal(profile.status, "draft");
});

test("active profile requires matching authenticated owner and consent", () => {
  const profile = {
    status: "active",
    consent: { voice_use: true, sample_storage: true }
  };
  assert.equal(canUseVoiceProfile(profile, "owner-1", "owner-1"), true);
  assert.equal(canUseVoiceProfile(profile, "owner-1", "owner-2"), false);
  assert.equal(canUseVoiceProfile(profile, "owner-1", "owner-1"), true);
});

test("serials are permanent and cannot be reissued", () => {
  assert.equal(assertNeverReuseSerial("VOICE-001", []), "VOICE-001");
  assert.throws(() => assertNeverReuseSerial("VOICE-001", ["VOICE-001"]), /already_issued/);
});
