const registry = {
  core: "coordination and governance",
  chat: "conversation interface",
  sidebar: "navigation and entity discovery",
  ui: "presentation and adaptive layout",
  voice: "context-aware voice processing",
  storage: "file indexing and organization",
  tool_factory: "safe tool creation and execution",
  quran_research: "Quran language research and evidence-based workflows"
};

const out = document.querySelector("#console");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#chatInput");
const voiceButton = document.querySelector("#voiceButton");
const voiceStatus = document.querySelector("#voiceStatus");

const questionEndings = ["কি","কী","কেন","কোথায়","কোথায়","কখন","কীভাবে","কিভাবে","কত","কার","কে","কোন","কোনটি"];

function applySmartPunctuation(text) {
  const chunks = String(text || "").trim().split(/(?:\n+|\s{3,})/).filter(Boolean);
  return chunks.map(chunk => {
    const value = chunk.trim();
    if (!value) return "";
    if (/[।?!,;:]$/.test(value)) return value;
    return questionEndings.some(word => value.endsWith(word)) ? value + "?" : value + "।";
  }).filter(Boolean).join(" ");
}

function correctContext(text) {
  let value = String(text || "").replace(/\s+/g, " ").trim();
  const corrections = [];
  const map = {
    "গবেষনা":"গবেষণা",
    "প্রজেকট":"প্রজেক্ট",
    "খুজে":"খুঁজে",
    "খুজুন":"খুঁজুন",
    "কোরান":"কুরআন",
    "কুরান":"কুরআন",
    "মোশারফ":"মোশাররফ",
    "মোশররফ":"মোশাররফ",
    "করতেছ":"করছ",
    "করতেছেন":"করছেন"
  };
  for (const [from, to] of Object.entries(map)) {
    const re = new RegExp("(^|\\s)" + from + "(?=\\s|$)", "g");
    const next = value.replace(re, "$1" + to);
    if (next !== value) corrections.push({from, to});
    value = next;
  }
  value = value.replace(/(\S+)(\s+\1)+/gi, "$1");
  return {text: value, corrections};
}

function processVoiceText(raw) {
  const corrected = correctContext(raw);
  return {text: applySmartPunctuation(corrected.text), corrections: corrected.corrections};
}

function renderRegistry() {
  out.textContent = Object.entries(registry)
    .map(([id, responsibility]) => id + " — " + responsibility)
    .join("\n");
}
renderRegistry();

form.addEventListener("submit", event => {
  event.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  out.textContent += "\n\nUser: " + value + "\nMosharrof Core: Foundation UI is online. Connect a model adapter to enable AI generation.";
  input.value = "";
});

let recognition = null;
if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new Recognition();
  recognition.lang = "bn-BD";
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    voiceButton.classList.add("active");
    voiceStatus.textContent = "Listening…";
  };

  recognition.onresult = event => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    const processed = processVoiceText(transcript);
    input.value = processed.text;
    voiceStatus.textContent = processed.corrections.length ? "Context corrected" : "Voice text ready";
  };

  recognition.onerror = event => {
    voiceStatus.textContent = "Voice error: " + event.error;
    voiceButton.classList.remove("active");
  };

  recognition.onend = () => {
    voiceButton.classList.remove("active");
    if (voiceStatus.textContent === "Listening…") voiceStatus.textContent = "Voice ready";
  };

  voiceButton.addEventListener("click", () => {
    try { recognition.start(); } catch (_) {}
  });
} else {
  voiceButton.disabled = true;
  voiceStatus.textContent = "Voice API unavailable in this browser";
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
