import { normalizeSpeechText, extractMessageText } from "./read-aloud-text.js";
export { normalizeSpeechText, extractMessageText } from "./read-aloud-text.js";
function iconMarkup(kind) {
  const paths = {
    speak: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths[kind] + '</svg>';
}

function setButtonContent(button, kind, label) {
  if (!button) return;
  button.innerHTML = iconMarkup(kind) + '<span>' + label + '</span>';
}

export const TTS_ENDPOINT = "https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/tts";
export const PERSONAL_VOICE_ENDPOINT = "https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/personal-voice";
const PROVIDERS = new Set(["auto", "edge", "gemini", "azure", "elevenlabs", "browser", "sarvam"]);
const VOICES = new Set(["bn-BD-PradeepNeural", "bn-BD-NabanitaNeural"]);
const PACE_KEY = "mosharrof_tts_pace_v1";

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
  setButtonContent(button, "speak", "পড়ে শোনান");
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
      setButtonContent(button, "pause", "বন্ধ করুন");
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

  async function speak(value, button, speakOptions = {}) {
    if (activeButton === button && button) {
      stop();
      return false;
    }
    stop();
    const text = normalizeSpeechText(value);
    if (!text) throw new Error("empty_message");
    if (button) {
      button.disabled = true;
      setButtonContent(button, "speak", "প্রস্তুত হচ্ছে…");
      button.title = "অডিও তৈরি হচ্ছে";
      if (button.dataset) button.dataset.audioState = "loading";
    }

    const provider = preference(storage, "mosharrof_tts_provider_v1", PROVIDERS, "auto");
    const selectedProfileId = String(speakOptions.profileId || button?.dataset?.voiceProfileId || "");
    if (provider === "browser" && !selectedProfileId) {
      if (startBrowserSpeech(text, button)) return null;
      resetButton(button);
      throw new Error("browser_speech_unavailable");
    }

    try {
      if (typeof fetchImpl !== "function") throw new Error("tts_fetch_unavailable");
      const voice = preference(storage, "mosharrof_tts_voice_v1", VOICES, "bn-BD-PradeepNeural");
      const savedPace = Number(storage?.getItem?.(PACE_KEY) || 1);
      const pace = Number.isFinite(savedPace) ? Math.min(1.25, Math.max(0.75, savedPace)) : 1;
      const profileId = selectedProfileId;
      let response;
      let data = {};
      if (profileId) {
        try {
          let token = null;
          if (typeof options.authTokenProvider === "function") token = await options.authTokenProvider();
          if (!token) {
            const auth = globalThis.MOSHARROF_AUTH || globalThis.mosharrofAuth;
            if (auth && typeof auth.getAccessToken === "function") token = await auth.getAccessToken();
          }
          if (!token && storage) {
            try {
              const ownSession = JSON.parse(storage.getItem("mosharrof_personal_voice_auth_v1") || "null");
              if (ownSession?.access_token) token = ownSession.access_token;
            } catch {}
            const keys = [];
            if (!token && typeof storage.length === "number" && typeof storage.key === "function") {
              for (let i = 0; i < storage.length; i += 1) {
                const key = storage.key(i);
                if (key && /^sb-.+-auth-token$/.test(key) && !keys.includes(key)) keys.push(key);
              }
            }
            for (const key of keys) {
              try {
                const session = JSON.parse(storage.getItem(key) || "null");
                if (session?.access_token) { token = session.access_token; break; }
              } catch {}
            }
          }
          if (!token) throw new Error("owner_login_required");
          response = await fetchImpl(PERSONAL_VOICE_ENDPOINT + "/profiles/" + encodeURIComponent(profileId) + "/synthesize", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
            body: JSON.stringify({ text })
          });
          data = await response.json().catch(() => ({}));
          if (!response.ok || !data.audio_data) throw new Error(data.error || "personal_voice_failed");
        } catch {
          // A personal voice failure must preserve the established Gemini voice as fallback.
          response = await fetchImpl(TTS_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, language_code: "bn-BD", pace: 1, provider: "gemini", genre: "general" })
          });
          data = await response.json().catch(() => ({}));
          if (!response.ok || !data.audio_data) throw new Error(data.error || "gemini_fallback_failed");
        }
      } else {
        response = await fetchImpl(TTS_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language_code: "bn-BD", pace: provider === "edge" || provider === "sarvam" ? pace : 1, provider, genre: "general", voice })
        });
        data = await response.json().catch(() => ({}));
        if (!response.ok || !data.audio_data) throw new Error(data.reason || data.error || "tts_generation_failed");
      }
      const blob = decodeAudioBlob(data.audio_data, data.mime_type || "audio/mpeg", { BlobCtor, atobImpl });
      activeButton = button || null;
      if (button) {
        button.disabled = false;
        setButtonContent(button, "pause", "বন্ধ করুন");
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
                setButtonContent(button, "speak", "আবার শুনুন");
                button.title = "অডিও তৈরি হয়েছে; প্লে না হলে নিচের ডাউনলোড ব্যবহার করুন";
              }
            }
          } else if (button) {
            setButtonContent(button, "speak", "আবার শুনুন");
            button.title = "অডিও তৈরি হয়েছে; ডাউনলোড করতে নিচের বোতাম চাপুন";
          }
        } catch {
          releaseAudioUrl();
          if (button) {
            setButtonContent(button, "speak", "আবার শুনুন");
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
