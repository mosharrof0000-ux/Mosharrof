const PROFILE_STATUSES = new Set(["draft", "active", "revoked", "deleted"]);
const CONSENT_KEYS = Object.freeze(["voice_use", "sample_storage", "model_training"]);

function cleanText(value, max = 80) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

export function normalizeConsent(input = {}) {
  return Object.freeze(Object.fromEntries(
    CONSENT_KEYS.map((key) => [key, input[key] === true])
  ));
}

export function hasRequiredVoiceConsent(consent = {}) {
  return consent.voice_use === true && consent.sample_storage === true;
}

export function createVoiceProfileDraft(input = {}) {
  const name = cleanText(input.name);
  if (!name) throw new TypeError("voice_profile_name_required");
  const consent = normalizeConsent(input.consent);
  if (!hasRequiredVoiceConsent(consent)) {
    throw new Error("explicit_voice_use_and_sample_storage_consent_required");
  }
  return Object.freeze({
    id: cleanText(input.id, 128) || null,
    serial: null, // Assigned only by the authenticated, persistent server allocator.
    name,
    language: cleanText(input.language, 24) || "bn-BD",
    providerId: cleanText(input.providerId, 48) || null,
    status: "draft",
    consent,
    createdAt: null,
    updatedAt: null
  });
}

export function normalizeVoiceProfile(profile = {}) {
  const status = PROFILE_STATUSES.has(profile.status) ? profile.status : "draft";
  const serial = /^VOICE-[0-9]{3,}$/.test(String(profile.serial || "")) ? profile.serial : null;
  return Object.freeze({
    id: cleanText(profile.id, 128) || null,
    serial,
    name: cleanText(profile.name),
    language: cleanText(profile.language, 24) || "bn-BD",
    providerId: cleanText(profile.providerId, 48) || null,
    status,
    consent: normalizeConsent(profile.consent),
    createdAt: profile.createdAt || null,
    updatedAt: profile.updatedAt || null
  });
}

export function canUseVoiceProfile(profile, ownerId, authenticatedOwnerId) {
  if (!ownerId || ownerId !== authenticatedOwnerId || !profile) return false;
  if (profile.status !== "active") return false;
  return hasRequiredVoiceConsent(profile.consent || {});
}

export function assertNeverReuseSerial(serial, issuedSerials = []) {
  if (!/^VOICE-[0-9]{3,}$/.test(String(serial || ""))) {
    throw new TypeError("invalid_voice_serial");
  }
  if (issuedSerials.includes(serial)) throw new Error("voice_serial_already_issued");
  return serial;
}
