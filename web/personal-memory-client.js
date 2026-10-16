import { createPersonalMemoryEngine, buildPersonalMemoryContext, inferMemoryCandidates } from "./personal-memory-engine.js";

const SECRET_LIKE = /(password|passcode|api[_ -]?key|access token|secret|otp|one.time.password|private key|পাসওয়ার্ড|পাসওয়ার্ড|গোপন কোড|এপিআই কি|টোকেন)/i;
const COMMAND = /^(?:(?:আমার\s*)?(?:ব্যক্তিগত\s*)?স্মৃতি\s*(?:দেখাও|দেখান|তালিকা|list)|(?:আমার\s*)?(?:সব\s*)?(?:ব্যক্তিগত\s*)?স্মৃতি\s*(?:মুছে ফেল|মুছে দাও|clear|delete all)|(?:মনে রাখো|স্মৃতিতে রাখো|remember)\s*[:：-]?\s*.+)$/i;

export function isPersonalMemoryCommand(text) {
  return COMMAND.test(String(text || "").trim());
}
export function createBrowserPersonalMemory(storage = localStorage) {
  const engine = createPersonalMemoryEngine({ storage });
  async function observe(text) {
    const value = String(text || "").trim();
    if (!value || SECRET_LIKE.test(value)) return;
    const candidates = inferMemoryCandidates(value);
    if (!candidates.length) return;
    const ledger = engine.exportAll();
    for (const candidate of candidates) {
      const duplicate = ledger.memories.some(item => item.status !== "superseded" && item.content === candidate.content && item.category === candidate.category);
      if (!duplicate) engine.remember(candidate);
    }
  }
  async function context(text) {
    return buildPersonalMemoryContext(engine.exportAll(), String(text || ""));
  }
  async function command(text) {
    const value = String(text || "").trim();
    if (/^(?:আমার\s*)?(?:ব্যক্তিগত\s*)?স্মৃতি\s*(?:দেখাও|দেখান|তালিকা|list)$/i.test(value)) {
      const report = engine.recall({ includeSuperseded: true, limit: 50 });
      if (!report.items.length) return "এখনও কোনো ব্যক্তিগত স্মৃতি সংরক্ষিত নেই।";
      return "আপনার স্মৃতির সাম্প্রতিক " + report.items.length + "টি নথি (মোট " + report.total + "টি):\n" + report.items.map(item => "- [" + item.category + " · " + String(item.status || "active") + " · " + String(item.created_at || "").slice(0,10) + "] " + item.content).join("\n");
    }
    if (/^(?:আমার\s*)?(?:সব\s*)?(?:ব্যক্তিগত\s*)?স্মৃতি\s*(?:মুছে ফেল|মুছে দাও|clear|delete all)$/i.test(value)) {
      if (!globalThis.confirm("সংরক্ষিত সব ব্যক্তিগত স্মৃতি মুছে ফেলবেন? চ্যাটের ইতিহাস আলাদাভাবে থাকবে।")) return "স্মৃতি মোছা বাতিল করা হয়েছে।";
      engine.clear();
      return "ব্যক্তিগত স্মৃতি মুছে ফেলা হয়েছে। চ্যাটের ইতিহাস আলাদাভাবে অক্ষত আছে।";
    }
    const explicit = value.match(/^(?:মনে রাখো|স্মৃতিতে রাখো|remember)\s*[:：-]?\s*(.{3,})$/i);
    if (explicit) {
      if (SECRET_LIKE.test(explicit[1])) return "নিরাপত্তার জন্য পাসওয়ার্ড, API key, টোকেন বা গোপন কোড ব্যক্তিগত স্মৃতিতে রাখছি না।";
      engine.remember({ category: "fact", content: explicit[1].trim(), confidence: 1, source: "explicit_user_command", status: "active", user_confirmed: true });
      return "আপনার কথাটি ব্যক্তিগত স্মৃতিতে সংরক্ষণ করেছি। দেখতে চাইলে লিখুন: “আমার স্মৃতি দেখাও”।";
    }
    return "স্মৃতি কমান্ডটি বোঝা যায়নি।";
  }
  return Object.freeze({ observe, context, command, recall: options => engine.recall(options), clear: () => engine.clear(), exportAll: () => engine.exportAll() });
}
