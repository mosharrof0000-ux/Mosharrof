/* Voice Entity UI: browser-local speech recognition with conservative transcript cleanup. */
(() => {
  const input = document.querySelector("#chatInput");
  const button = document.querySelector("#voiceButton");
  const status = document.querySelector("#voiceStatus");
  if (!input || !button || !status) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    button.disabled = true;
    status.textContent = "Voice unavailable in this browser";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "bn-BD";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const corrections = [
    ["গবেষনা", "গবেষণা"], ["প্রজেকট", "প্রজেক্ট"], ["খুজে", "খুঁজে"],
    ["খুজুন", "খুঁজুন"], ["করতেছ", "করছ"], ["করতেছেন", "করছেন"],
    ["মশারফ", "মোশাররফ"], ["মোশরফ", "মোশাররফ"], ["কোরান", "কুরআন"],
    ["কুরান", "কুরআন"], ["মোশারফ এর", "মোশাররফের"], ["মোশরফ এর", "মোশাররফের"]
  ];
  const questionStart = /^(কি |কী |কেন |কখন |কোথায় |কোথায় |কীভাবে |কিভাবে |what |why |when |where |who |how |is |are |am |do |does |did |can |could |would |will |shall )/i;

  function normalize(text) {
    let value = text.trim().replace(/\s+/g, " ");
    for (const [from, to] of corrections) value = value.split(from).join(to);
    value = value.replace(/\s+([,।!?])/g, "$1").replace(/([!?।])\1+/g, "$1");
    if (!value) return "";
    if (/[.!?।]$/.test(value)) return value;
    return value + (questionStart.test(value) ? "?" : "।");
  }

  recognition.onstart = () => {
    button.classList.add("recording");
    button.textContent = "●";
    status.textContent = "Listening…";
  };
  recognition.onresult = (event) => {
    const raw = event.results?.[0]?.[0]?.transcript || "";
    input.value = normalize(raw);
    status.textContent = "Voice text ready";
  };
  recognition.onerror = (event) => {
    status.textContent = event.error === "not-allowed" ? "Microphone permission required" : "Voice recognition error";
  };
  recognition.onend = () => {
    button.classList.remove("recording");
    button.textContent = "🎙";
  };
  button.addEventListener("click", () => {
    try { recognition.start(); } catch (_) { recognition.stop(); }
  });
})();
