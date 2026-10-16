import { createPersonalMemoryEngine, buildPersonalMemoryContext, inferMemoryCandidates } from "./personal-memory-engine.js";

const SECRET = /(?:password|passcode|\bpin\b|\botp\b|api[_ -]?key|access[_ -]?token|secret|verification code|পাসওয়ার্ড|পাসওয়ার্ড|ওটিপি|পিন কোড|কার্ড নম্বর|cvv)/i;

function topicFolder(text, category) {
  const t = String(text || "").toLowerCase();
  const topic = /quran|কোরআন|কুরআন|আয়াত|আয়াত|তাফসির/.test(t) ? "quran-research"
    : /android|অ্যান্ড্রয়েড|অ্যান্ড্রয়েড|ফোন|ডিভাইস/.test(t) ? "android-agent"
    : /গল্প|উপন্যাস|কবিতা|লেখা|story|novel|writing/.test(t) ? "writing"
    : /voice|কণ্ঠ|ভয়েস|ভয়েস|tts|বক্তৃতা/.test(t) ? "voice"
    : /memory|স্মৃতি|মেমোরি/.test(t) ? "memory-engine"
    : /github|worker|deploy|ডেপ্লয়|ডেপ্লয়|রিপোজিটরি|প্রজেক্ট|প্রকল্প/.test(t) ? "mosharrof-project"
    : "general";
  return category + "/" + topic;
}

export function createBrowserPersonalMemory(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new TypeError("Browser storage is required for personal memory.");
  }
  const engine = createPersonalMemoryEngine({ storage, namespace: "mosharrof.personal-memory.v1" });

  function sameActive(candidate) {
    return engine.recall({ category: candidate.category, folder: candidate.folder }).items
      .some(item => item.content === candidate.content && item.status === "active");
  }

  function observe(text) {
    const candidates = inferMemoryCandidates(text);
    const saved = [];
    for (const candidate of candidates) {
      if (SECRET.test(candidate.content)) continue;
      const folder = topicFolder(candidate.content, candidate.category);
      const normalized = { ...candidate, folder, status: "active",
        user_confirmed: /মনে রাখ|ভবিষ্যতে|পরের বার|সবসময়|সব সময়|আমার পছন্দ|remember that|from now on|always/i.test(candidate.content),
        source: "conversation" };
      if (sameActive(normalized)) continue;
      saved.push(engine.remember(normalized));
    }
    return { saved: saved.length, candidates: candidates.length };
  }

  function context(text) {
    return buildPersonalMemoryContext(engine.exportAll(), text);
  }

  function command(text) {
    const value = String(text || "").trim();
    if (/স্মৃতি\s*(মুছে ফেল|মুছে দাও)|স্মৃতি.*delete all|memory.*clear/i.test(value)) {
      const count = engine.recall({ includeSuperseded: true }).total;
      engine.clear();
      return "আপনার ব্রাউজারে সংরক্ষিত " + count + "টি স্মৃতি মুছে ফেলা হয়েছে।";
    }
    const remember = value.match(/^(?:মনে রাখো|স্মৃতিতে রাখো|remember)\s*[:：-]?\s*(.+)$/i);
    if (remember) {
      if (SECRET.test(remember[1])) return "নিরাপত্তার কারণে পাসওয়ার্ড, API key, টোকেন বা গোপন কোড স্মৃতিতে রাখা হয়নি।";
      const text = remember[1].slice(0, 2000);
      const category = "preference";
      engine.remember({ category, folder: topicFolder(text, category), content: text, confidence: 1, source: "explicit-memory-command", user_confirmed: true });
      return "মনে রাখা হয়েছে। এটি আপনার এই ব্রাউজারের স্মৃতিতে বিষয়ভিত্তিক ফোল্ডারে সংরক্ষিত হয়েছে।";
    }
    const ledger = engine.exportAll();
    if (/স্মৃতি|memory|list/i.test(value)) {
      const active = ledger.memories.filter(m => !["superseded", "archived"].includes(m.status));
      const folders = [...new Set(active.map(m => m.folder || m.category))];
      if (!active.length) return "এখনো কোনো ব্যক্তিগত স্মৃতি সংরক্ষিত নেই।";
      return "স্মৃতি: " + active.length + "টি সক্রিয়, " + folders.length + "টি বিষয়ভিত্তিক ফোল্ডার।\n" +
        folders.map(folder => "• " + folder + ": " + active.filter(m => (m.folder || m.category) === folder).length + "টি").join("\n") +
        "\nসর্বশেষ: " + active.slice(-5).map(m => m.content).join(" | ");
    }
    return "স্মৃতি কমান্ড বুঝতে পারিনি। ‘স্মৃতি দেখাও’, ‘মনে রাখো: …’ অথবা ‘সব স্মৃতি মুছে ফেল’ বলতে পারেন।";
  }

  function recordTurn(userText) {
    // The user's stated intent/corrections are the source of truth. Do not store the model's guesses as facts.
    return observe(userText);
  }

  return Object.freeze({
    observe,
    context,
    command,
    recordTurn,
    list: options => engine.recall(options),
    timeline: options => engine.timeline(options),
    exportAll: () => engine.exportAll(),
    importAll: snapshot => engine.importAll(snapshot),
    forget: id => engine.revise(id, { status: "archived" }),
    clear: () => engine.clear(),
    stats: () => ({ total: engine.recall({ includeSuperseded: true }).total, folders: [...new Set(engine.timeline().items.map(m => m.folder || m.category))].length, storage: "browser localStorage" })
  });
}
