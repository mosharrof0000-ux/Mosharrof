export const TTS_ENDPOINT = "https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/tts";
const PROVIDERS = new Set(["auto", "edge", "gemini", "azure", "elevenlabs", "browser", "sarvam"]);
const VOICES = new Set(["bn-BD-PradeepNeural", "bn-BD-NabanitaNeural"]);

export function normalizeSpeechText(value) {
  return String(value == null ? "" : value)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~>#|]/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

export function extractMessageText(message) {
  if (!message) return "";
  let source = message;
  if (typeof message.cloneNode === "function") {
    source = message.cloneNode(true);
    if (typeof source.querySelectorAll === "function") {
      source.querySelectorAll(".message-actions-wrap,.message-actions,.message-actions-toggle,.message-action,.message-meta-row,.time,.label")
        .forEach((element) => element.remove());
    }
  }
  return normalizeSpeechText(source.innerText || source.textContent || "");
}

export function decodeAudioBlob(encoded, mimeType = "audio/mpeg", options = {}) {
  const BlobCtor = options.BlobCtor || globalThis.Blob;
  const atobImpl = options.atobImpl || globalThis.atob;
  if (typeof encoded !== "string" || !encoded) throw new TypeError("audio_data is required");
  if (typeof BlobCtor !== "function" || typeof atobImpl !== "function") throw new Error("audio decoding is unavailable");
  const binary = atobImpl(encoded);
  const parts = [];
  for (let offset = 0; offset < binary.length; offset += 32768) {
    const slice = binary.slice(offset, offset + 32768);
    const bytes = new Uint8Array(slice.length);
    for (let index = 0; index < slice.length; index += 1) bytes[index] = slice.charCodeAt(index);
    parts.push(bytes);
  }
  return new BlobCtor(parts, { type: mimeType || "audio/mpeg" });
}

function safeStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

function preference(storage, key, allowed, fallback) {
  try {
    const value = storage && storage.getItem(key);
    return allowed.has(value) ? value : fallback;
  } catch { return fallback; }
}

function resetButton(button) {
  if (!button) return;
  button.disabled = false;
  button.textContent = "🔊 পড়ে শোনান";
  button.title = "পাঠানো মেসেজটি পড়ে শোনান";
  if (button.dataset) button.dataset.audioState = "idle";
}

export function createReadAloudController(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const AudioCtor = options.AudioCtor || globalThis.Audio;
  const URLApi = options.URLApi || globalThis.URL;
  const BlobCtor = options.BlobCtor || globalThis.Blob;
  const atobImpl = options.atobImpl || globalThis.atob;
  const storage = options.storage === undefined ? safeStorage() : options.storage;
  const speechSynthesisRef = options.speechSynthesisRef === undefined ? globalThis.speechSynthesis : options.speechSynthesisRef;
  const UtteranceCtor = options.UtteranceCtor || globalThis.SpeechSynthesisUtterance;
  let activeAudio = null;
  let activeAudioUrl = null;
  let activeButton = null;
  let activeUtterance = null;

  function releaseAudioUrl() {
    if (activeAudioUrl && URLApi && typeof URLApi.revokeObjectURL === "function") {
      try { URLApi.revokeObjectURL(activeAudioUrl); } catch {}
    }
    activeAudioUrl = null;
  }

  function stop() {
    if (activeAudio) {
      try { activeAudio.pause(); } catch {}
      activeAudio = null;
    }
    if (activeUtterance && speechSynthesisRef && typeof speechSynthesisRef.cancel === "function") {
      try { speechSynthesisRef.cancel(); } catch {}
      activeUtterance = null;
    }
    releaseAudioUrl();
    if (activeButton) resetButton(activeButton);
    activeButton = null;
  }

  function startBrowserSpeech(text, button) {
    if (!speechSynthesisRef || typeof speechSynthesisRef.speak !== "function" || typeof UtteranceCtor !== "function") return false;
    const utterance = new UtteranceCtor(text);
    utterance.lang = "bn-BD";
    utterance.rate = 1;
    activeButton = button;
    activeUtterance = utterance;
    if (button) {
      button.disabled = false;
      button.textContent = "⏸ বন্ধ করুন";
      button.title = "ব্রাউজার ভয়েস চলছে; এই অডিও ডাউনলোড করা যাবে না";
      if (button.dataset) button.dataset.audioState = "speaking";
    }
    utterance.onend = () => {
      if (activeUtterance === utterance) activeUtterance = null;
      if (activeButton === button) activeButton = null;
      resetButton(button);
    };
    utterance.onerror = utterance.onend;
    speechSynthesisRef.speak(utterance);
    return true;
  }

  async function speak(value, button) {
    if (activeButton === button && button) {
      stop();
      return false;
    }
    stop();
    const text = normalizeSpeechText(value);
    if (!text) throw new Error("empty_message");
    if (button) {
      button.disabled = true;
      button.textContent = "⏳ প্রস্তুত হচ্ছে…";
      button.title = "অডিও তৈরি হচ্ছে";
      if (button.dataset) button.dataset.audioState = "loading";
    }

    const provider = preference(storage, "mosharrof_tts_provider_v1", PROVIDERS, "auto");
    if (provider === "browser") {
      if (startBrowserSpeech(text, button)) return null;
      resetButton(button);
      throw new Error("browser_speech_unavailable");
    }

    try {
      if (typeof fetchImpl !== "function") throw new Error("tts_fetch_unavailable");
      const voice = preference(storage, "mosharrof_tts_voice_v1", VOICES, "bn-BD-PradeepNeural");
      const response = await fetchImpl(TTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language_code: "bn-BD", pace: 1, provider, genre: "general", voice })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.audio_data) throw new Error(data.reason || data.error || "tts_generation_failed");
      const blob = decodeAudioBlob(data.audio_data, data.mime_type || "audio/mpeg", { BlobCtor, atobImpl });
      activeButton = button || null;
      if (button) {
        button.disabled = false;
        button.textContent = "⏸ বন্ধ করুন";
        button.title = "তৈরি অডিও চলছে";
        if (button.dataset) button.dataset.audioState = "speaking";
      }
      if (typeof URLApi?.createObjectURL === "function") {
        try {
          activeAudioUrl = URLApi.createObjectURL(blob);
          if (typeof AudioCtor === "function") {
            activeAudio = new AudioCtor(activeAudioUrl);
            activeAudio.onended = () => {
              if (activeButton === button) activeButton = null;
              activeAudio = null;
              releaseAudioUrl();
              resetButton(button);
            };
            try { await activeAudio.play(); }
            catch {
              if (button) {
                button.textContent = "▶ আবার শুনুন";
                button.title = "অডিও তৈরি হয়েছে; প্লে না হলে নিচের ডাউনলোড ব্যবহার করুন";
              }
            }
          } else if (button) {
            button.textContent = "▶ আবার শুনুন";
            button.title = "অডিও তৈরি হয়েছে; ডাউনলোড করতে নিচের বোতাম চাপুন";
          }
        } catch {
          releaseAudioUrl();
          if (button) {
            button.textContent = "▶ আবার শুনুন";
            button.title = "অডিও তৈরি হয়েছে; ডাউনলোড করতে নিচের বোতাম চাপুন";
          }
        }
      }
      return blob;
    } catch (error) {
      if (startBrowserSpeech(text, button)) return null;
      resetButton(button);
      throw error;
    }
  }

  return Object.freeze({ speak, stop });
}
