/**
 * User Preference Intelligence organ.
 * This first foundation is in-memory only: no hidden tracking, network access,
 * sensitive-trait inference, or writes to other organs.
 */
const ALLOWED_SOURCES = new Set(["explicit", "inferred", "corrected"]);
const ALLOWED_SCOPES = new Set(["global", "presentation", "voice", "writing", "research", "interaction"]);
const MAX_KEY_LENGTH = 80;
const MAX_VALUE_LENGTH = 240;

function cleanText(value, label, maxLength) {
  if (typeof value !== "string") throw new TypeError(label + " must be a string");
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) {
    throw new RangeError(label + " must be 1-" + maxLength + " characters");
  }
  return cleaned;
}

function validatePreference(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("preference must be an object");
  }
  const key = cleanText(input.key, "key", MAX_KEY_LENGTH).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(key)) throw new TypeError("key must use safe lowercase identifier characters");
  const value = cleanText(input.value, "value", MAX_VALUE_LENGTH);
  const scope = input.scope ?? "global";
  if (!ALLOWED_SCOPES.has(scope)) throw new TypeError("unsupported preference scope");
  const source = input.source ?? "explicit";
  if (!ALLOWED_SOURCES.has(source)) throw new TypeError("unsupported preference source");
  const confidence = input.confidence ?? (source === "explicit" || source === "corrected" ? 1 : 0.5);
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new RangeError("confidence must be between 0 and 1");
  }
  if (source === "inferred" && confidence < 0.65) {
    throw new RangeError("low-confidence inferences must not be stored as preferences");
  }
  return Object.freeze({
    key, value, scope, source, confidence,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : null
  });
}

export function createPreferenceIntelligence() {
  const preferences = new Map();
  return Object.freeze({
    recordPreference(input) {
      const item = validatePreference(input);
      const mapKey = item.scope + ":" + item.key;
      const current = preferences.get(mapKey);
      // An inference cannot silently overwrite a clear user instruction.
      if (current && current.source !== "inferred" && item.source === "inferred") {
        return Object.freeze({ stored: false, reason: "explicit-preference-protected", preference: current });
      }
      preferences.set(mapKey, item);
      return Object.freeze({ stored: true, preference: item });
    },
    getPreferences(options = {}) {
      const scope = options.scope;
      if (scope !== undefined && !ALLOWED_SCOPES.has(scope)) throw new TypeError("unsupported preference scope");
      return [...preferences.values()]
        .filter((item) => scope === undefined || item.scope === scope || item.scope === "global")
        .filter((item) => options.minConfidence === undefined || item.confidence >= options.minConfidence)
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((item) => ({ ...item }));
    },
    correctPreference(input) {
      return this.recordPreference({ ...input, source: "corrected", confidence: 1 });
    },
    forgetPreference(key, scope = "global") {
      const safeKey = cleanText(key, "key", MAX_KEY_LENGTH).toLowerCase();
      if (!ALLOWED_SCOPES.has(scope)) throw new TypeError("unsupported preference scope");
      return preferences.delete(scope + ":" + safeKey);
    }
  });
}
