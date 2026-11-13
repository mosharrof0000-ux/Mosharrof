const CONTROL_KEYS = Object.freeze(["speed", "pitch", "emotion", "intensity", "pause", "emphasis"]);
const PROVIDER_CONTROLS = Object.freeze({
  edge: Object.freeze({ speed: true }),
  sarvam: Object.freeze({ speed: true }),
  gemini: Object.freeze({}),
  azure: Object.freeze({}),
  elevenlabs: Object.freeze({}),
  indicf5: Object.freeze({})
});

export function getProviderControlCapabilities(providerId) {
  return normalizeProviderCapabilities({ providerId, supportsVoiceCloning: String(providerId || "").toLowerCase() === "indicf5", controls: PROVIDER_CONTROLS[String(providerId || "").toLowerCase()] || {} });
}

export function normalizeProviderCapabilities(input = {}) {
  const controls = Object.fromEntries(CONTROL_KEYS.map((key) => [key, input.controls?.[key] === true]));
  return Object.freeze({
    providerId: String(input.providerId || "").trim(),
    supportsVoiceCloning: input.supportsVoiceCloning === true,
    supportsCatalogSearch: input.supportsCatalogSearch === true,
    supportsPreview: input.supportsPreview === true,
    supportsDownload: input.supportsDownload === true,
    controls: Object.freeze(controls)
  });
}

export function filterVoiceControls(values = {}, capabilities = {}) {
  const supported = capabilities.controls || {};
  return Object.freeze(Object.fromEntries(
    CONTROL_KEYS.filter((key) => supported[key] === true && values[key] !== undefined)
      .map((key) => [key, values[key]])
  ));
}

export function chooseSpeechProvider({ requestedProvider, availableProviders = [], geminiProviderId = "gemini" } = {}) {
  const available = new Set(availableProviders);
  if (requestedProvider && available.has(requestedProvider)) return requestedProvider;
  if (available.has(geminiProviderId)) return geminiProviderId;
  return availableProviders[0] || null;
}

export function resolveSpeechFallback({ requestedProvider, failedProvider, availableProviders = [], geminiProviderId = "gemini" } = {}) {
  if (failedProvider !== requestedProvider && failedProvider !== geminiProviderId) return null;
  if (failedProvider === geminiProviderId) return null;
  return availableProviders.includes(geminiProviderId) ? geminiProviderId : null;
}
