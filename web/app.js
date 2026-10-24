/**
 * MOSHARROF AI — Chat Entity Runtime (V5)
 * Architecture rules:
 * - Entity-first, model-agnostic
 * - Only core oversees all
 * - chat entity owns conversation surface
 * - voice entity owns transcript processing
 * - No destructive delete of system state
 */

/* ── Entity Registry (frontend mirror) ── */
const REGISTRY = {
  core:            { responsibility: "coordination and governance" },
  chat:            { responsibility: "conversation interface" },
  sidebar:         { responsibility: "navigation and entity discovery" },
  ui:              { responsibility: "presentation and adaptive layout" },
  voice:           { responsibility: "context-aware voice processing" },
  storage:         { responsibility: "file indexing and organization" },
  tool_factory:    { responsibility: "safe tool creation and execution" },
  quran_research:  { responsibility: "Quran language research and evidence-based workflows" }
};

const ACTIVE_ENTITY = "chat"; // current conversation context

/* ── DOM ── */
const $ = (s) => document.querySelector(s);
const messagesEl   = $("#messages");
const chatScroll   = $("#chat-scroll");
const inputEl      = $("#user-input");
const sendBtn      = $("#btn-send");
const plusBtn      = $("#btn-plus");
const leftBtn      = $("#btn-left");
const rightBtn     = $("#btn-right");
const scrim        = $("#scrim");
const drawerLeft   = $("#drawer-left");
const drawerRight  = $("#drawer-right");
const closeLeft    = $("#close-left");
const closeRight   = $("#close-right");
const voiceStatus  = $("#voice-status");
const toastEl      = $("#toast");

/* ── Voice: Bengali context correction (from existing system) ── */
const QUESTION_ENDINGS = ["কি","কী","কেন","কোথায়","কোথায়","কখন","কীভাবে","কিভাবে","কত","কার","কে","কোন","কোনটি"];

const CORRECTION_MAP = {
  "গবেষনা":"গবেষণা", "প্রজেকট":"প্রজেক্ট", "খুজে":"খুঁজে", "খুজুন":"খুঁজুন",
  "কোরান":"কুরআন", "কুরান":"কুরআন", "মোশারফ":"মোশাররফ", "মোশররফ":"মোশাররফ",
  "করতেছ":"করছ", "করতেছেন":"করছেন"
};

function applySmartPunctuation(text) {
  const chunks = String(text || "").trim().split(/(?:\n+|\s{3,})/).filter(Boolean);
  return chunks.map(chunk => {
    const value = chunk.trim();
    if (!value) return "";
    if (/[।?!,;:]$/.test(value)) return value;
    return QUESTION_ENDINGS.some(w => value.endsWith(w)) ? value + "?" : value + "।";
  }).filter(Boolean).join(" ");
}

function correctContext(text) {
  let value = String(text || "").replace(/\s+/g, " ").trim();
  const corrections = [];
  for (const [from, to] of Object.entries(CORRECTION_MAP)) {
    const re = new RegExp("(^|\\s)" + from + "(?=\\s|$)", "g");
    const next = value.replace(re, "$1" + to);
    if (next !== value) corrections.push({ from, to });
    value = next;
  }
  value = value.replace(/(\S+)(\s+\1)+/gi, "$1");
  return { text: value, corrections };
}

function processVoiceText(raw) {
  const corrected = correctContext(raw);
  return {
    text: applySmartPunctuation(corrected.text),
    corrections: corrected.corrections
  };
}

/* ── UI helpers ── */
function toast(msg, ms = 2200) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), ms);
}

function showVoiceStatus(text) {
  voiceStatus.textContent = text;
  voiceStatus.classList.add("show");
}

function hideVoiceStatus() {
  voiceStatus.classList.remove("show");
}

function autoResize() {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatScroll.scrollTop = chatScroll.scrollHeight;
  });
}

/* ── Message rendering (chat entity surface) ── */
function renderMessage(role, text, label) {
  const node = document.createElement("div");
  node.className = `message ${role}`;
  const lbl = document.createElement("span");
  lbl.className = "label";
  lbl.textContent = label || (role === "user" ? "আপনি" : "MOSHARROF AI · core");
  node.appendChild(lbl);
  node.appendChild(document.createTextNode(text));
  messagesEl.appendChild(node);
  scrollToBottom();
  return node;
}

function renderTyping() {
  const node = document.createElement("div");
  node.className = "message ai typing";
  node.id = "typing-indicator";
  node.innerHTML = `<span class="label">MOSHARROF AI · core</span><span class="dots"><span></span><span></span><span></span></span>`;
  messagesEl.appendChild(node);
  scrollToBottom();
  return node;
}

function removeTyping() {
  const t = $("#typing-indicator");
  if (t) t.remove();
}

/* ── Core response (model-agnostic placeholder) ── */
async function coreRespond(userText) {
  // Architecture: brain_adapter will replace this later.
  // Until a model is connected, Core returns a bounded status reply.
  await new Promise(r => setTimeout(r, 600 + Math.random() * 400));

  const lower = userText.toLowerCase();
  if (/কুরআন|কোরান|আয়াত|সূরা|তাফসীর/.test(userText)) {
    return "কুরআন গবেষণা মডিউল (quran_research entity) প্রস্তুত। নির্দিষ্ট আয়াত বা বিষয় বললে আমি প্রেক্ষাপট ও ভাষা বিশ্লেষণের কাঠামো দিতে পারি। মডেল অ্যাডাপ্টার কানেক্ট হলে পূর্ণ উত্তর আসবে।";
  }
  if (/ভয়েস|voice|শুন/.test(userText)) {
    return "Voice entity সক্রিয়। + বাটনে চাপ দিয়ে বাংলায় কথা বলুন — কনটেক্সট কারেকশন ও স্মার্ট পাঙ্কচুয়েশন স্বয়ংক্রিয়ভাবে কাজ করবে।";
  }
  if (/এন্টিটি|entity|রেজিস্ট্রি|registry|সিস্টেম/.test(userText)) {
    return Object.entries(REGISTRY)
      .map(([id, e]) => `• ${id} — ${e.responsibility}`)
      .join("\n");
  }
  return "Foundation UI অনলাইন। Core entity সক্রিয়। মডেল অ্যাডাপ্টার কানেক্ট করলে পূর্ণ AI জেনারেশন চালু হবে। আপনি কী জানতে চান?";
}

/* ── Send flow ── */
let busy = false;

async function sendMessage() {
  const raw = inputEl.value.trim();
  if (!raw || busy) return;

  busy = true;
  sendBtn.disabled = true;

  const processed = correctContext(raw);
  const text = applySmartPunctuation(processed.text);

  inputEl.value = "";
  autoResize();
  renderMessage("user", text);

  if (processed.corrections.length) {
    toast("Context corrected: " + processed.corrections.map(c => c.from + "→" + c.to).join(", "));
  }

  renderTyping();
  try {
    const reply = await coreRespond(text);
    removeTyping();
    renderMessage("ai", reply);
  } catch (err) {
    removeTyping();
    renderMessage("ai", "Core-এ সাময়িক সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    console.error("[MOSHARROF Core]", err);
  }

  busy = false;
  sendBtn.disabled = false;
  inputEl.focus();
}

/* ── Drawer control ── */
function openDrawer(side) {
  scrim.classList.add("open");
  if (side === "left") {
    drawerLeft.classList.add("open");
    drawerLeft.setAttribute("aria-hidden", "false");
  } else {
    drawerRight.classList.add("open");
    drawerRight.setAttribute("aria-hidden", "false");
  }
}

function closeDrawers() {
  scrim.classList.remove("open");
  drawerLeft.classList.remove("open");
  drawerRight.classList.remove("open");
  drawerLeft.setAttribute("aria-hidden", "true");
  drawerRight.setAttribute("aria-hidden", "true");
}

/* ── Voice recognition ── */
let recognition = null;

function initVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showVoiceStatus("Voice API unavailable");
    return;
  }
  recognition = new SR();
  recognition.lang = "bn-BD";
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => showVoiceStatus("Listening…");
  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    const processed = processVoiceText(transcript);
    inputEl.value = processed.text;
    autoResize();
    showVoiceStatus(processed.corrections.length ? "Context corrected" : "Voice text ready");
  };
  recognition.onerror = (e) => {
    showVoiceStatus("Voice error: " + e.error);
    setTimeout(hideVoiceStatus, 2000);
  };
  recognition.onend = () => {
    if (voiceStatus.textContent === "Listening…") hideVoiceStatus();
    else setTimeout(hideVoiceStatus, 1500);
  };
}

function startVoice() {
  if (!recognition) {
    toast("এই ব্রাউজারে Voice API নেই");
    return;
  }
  try { recognition.start(); } catch (_) {}
}

/* ── Events ── */
sendBtn.addEventListener("click", sendMessage);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
inputEl.addEventListener("input", autoResize);

plusBtn.addEventListener("click", startVoice);

leftBtn.addEventListener("click", () => openDrawer("left"));
rightBtn.addEventListener("click", () => openDrawer("right"));
closeLeft.addEventListener("click", closeDrawers);
closeRight.addEventListener("click", closeDrawers);
scrim.addEventListener("click", closeDrawers);

$("#btn-new-chat")?.addEventListener("click", () => {
  messagesEl.innerHTML = "";
  renderMessage("ai", "নতুন কথোপকথন শুরু হয়েছে। আমি কীভাবে সাহায্য করতে পারি?");
  closeDrawers();
  toast("New chat started");
});

$("#btn-clear")?.addEventListener("click", () => {
  messagesEl.innerHTML = "";
  renderMessage("ai", "মেসেজ মুছে ফেলা হয়েছে। আমি কীভাবে সাহায্য করতে পারি?");
  closeDrawers();
  toast("Messages cleared");
});

$("#btn-voice-toggle")?.addEventListener("click", () => {
  closeDrawers();
  startVoice();
});

/* Entity nav (sidebar) */
document.querySelectorAll("#nav-left button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#nav-left button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const entity = btn.dataset.entity;
    toast(`${entity} — ${REGISTRY[entity]?.responsibility || "entity"}`);
    // Future: EntityBus.emit('entity:activated', { entity })
  });
});

/* ── Boot ── */
initVoice();
autoResize();
inputEl.focus();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

console.log("[MOSHARROF] Chat entity online · Core overseeing · Model adapter: pending");
