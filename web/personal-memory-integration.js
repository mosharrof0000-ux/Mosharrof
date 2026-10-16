import { createPersonalMemoryEngine } from "./personal-memory-engine.js";

const API_KEY = "__mosharrofPersonalMemoryEngine";
const SECRET_PATTERN = /(?:api[_ -]?key|password|passcode|otp|one[- ]time code|access token|refresh token|secret)\s*[:=]/i;
function safeToRemember(text) {
  const value = String(text || "").trim();
  if (value.length < 8 || SECRET_PATTERN.test(value)) return false;
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value)) return false;
  return true;
}
function notify(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2400);
}
export async function initializePersonalMemoryIntegration() {
  if (window[API_KEY]) return window[API_KEY];
  let engine;
  try { engine = await createPersonalMemoryEngine(); }
  catch (error) {
    console.warn("MOSHARROF personal memory unavailable:", error);
    window.dispatchEvent(new CustomEvent("mosharrof-memory-status", { detail: { ready: false, reason: "storage_unavailable" } }));
    return null;
  }

  const api = {
    ready: true,
    engine,
    async remember(text, options) {
      if (!safeToRemember(text)) return { stored: false, reason: "sensitive_or_short" };
      return engine.rememberMessage(text, options);
    },
    async stats() { return engine.stats(); },
    async list(query) { return engine.relevantMemories(query || "", 100); },
    async forgetAll() { return engine.forgetAll(); },
    async learnPreference(key, value, options) { return engine.learnPreference(key, value, options); }
  };
  window[API_KEY] = api;

  if (typeof window.coreReply === "function" && !window.coreReply.__memoryWrapped) {
    const originalCoreReply = window.coreReply;
    const wrappedCoreReply = function(text, image) {
      const userText = String(text || "").trim();
      return (async function() {
        if (safeToRemember(userText)) {
          await engine.rememberMessage(userText, { source: "user-message", importance: /মনে রাখ|আমার পছন্দ|সবসময়|সর্বদা|always remember|i prefer/i.test(userText) ? "high" : "normal" }).catch(error => console.warn("Memory write failed:", error));
        }
        let contextualText = userText;
        try {
          contextualText = await engine.buildContext(userText);
        } catch (error) {
          console.warn("Memory retrieval failed; continuing without memories:", error);
        }
        const response = await originalCoreReply(contextualText, image);
        if (response && response.text && safeToRemember(response.text)) {
          await engine.rememberMessage(response.text, { source: "assistant-response", topic: undefined }).catch(error => console.warn("Assistant memory write failed:", error));
        }
        return response;
      })();
    };
    wrappedCoreReply.__memoryWrapped = true;
    wrappedCoreReply.__originalCoreReply = originalCoreReply;
    window.coreReply = wrappedCoreReply;
  }

  window.dispatchEvent(new CustomEvent("mosharrof-memory-status", { detail: { ready: true } }));
  console.info("MOSHARROF personal memory engine ready");
  return api;
}

initializePersonalMemoryIntegration().catch(error => console.warn("MOSHARROF memory initialization failed:", error));
