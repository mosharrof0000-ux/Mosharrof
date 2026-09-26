/* Voice Entity UI — browser-local speech recognition with conservative normalization. */
(() => {
  const form = document.querySelector("#chatForm");
  const input = document.querySelector("#chatInput");
  const button = document.querySelector("#voiceButton");
  const status = document.querySelector("#voiceStatus");
  if (!form || !input || !button || !status) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    button.disabled = true;
    button.title = "Speech recognition is not available in this browser.";
    status.textContent = "Voice unavailable in this browser";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "bn-BD";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const questionStart = /^(কি |কী |কেন |কখন |কোথায় |কোথায় |কীভাবে |কিভাবে |what |why |when |where |who |how |is |are |am |do |does |did |can |could |would |will |shall )/i;

  function correctContext(text) {
    const replacements = [
      ["কি করতেছ", "কি করছ"],
      ["করতেছেন", "করছেন"],
      ["যাইতেছি", "যাচ্ছি"],
      ["আসতেছি", "আসছি"],
      ["করবেনা", "করবে না"]
    ];
    return replacements.reduce((value, [from, to]) => value.split(from).join(to), text.trim().replace(/\s+/g, " "));
  }

  function punctuate(text) {
    const value = text.trim().replace(/\s+([,।!?])/g, "$1").replace(/([!?।])\1+/g, "$1");
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
    const finalText = punctuate(correctContext(raw));
    input.value = finalText;
    status.textContent = "Voice text ready";
  };

  recognition.onerror = (event) => {
    status.textContent = event.error === "not-allowed"
      ? "Microphone permission is required"
      : "Voice recognition error";
  };

  recognition.onend = () => {
    button.classList.remove("recording");
    button.textContent = "🎙";
  };

  button.addEventListener("click", () => {
    try {
      recognition.start();
    } catch (_) {
      recognition.stop();
    }
  });
})();
