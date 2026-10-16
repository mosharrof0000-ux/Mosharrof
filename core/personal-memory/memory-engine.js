/**
 * Personal Memory Engine — local-first, topic-indexed, time-aware memory.
 * Storage adapters may be IndexedDB or an isolated test store. No fixed item count.
 * Browser/device storage quotas still apply; this is not infinite physical storage.
 */
export const MEMORY_TOPICS = Object.freeze({
  projects: ["project", "প্রজেক্ট", "রেপো", "repo", "github", "কোড", "কোডিং", "লাইভ", "ডেপ্লয়", "deploy", "worker", "mosharrof", "মোশাররফ"],
  preferences: ["পছন্দ", "চাই", "চাইনা", "ভালো লাগে", "prefer", "preference", "style", "স্টাইল", "সংক্ষিপ্ত", "বিস্তারিত"],
  writing: ["গল্প", "উপন্যাস", "লেখা", "শব্দ", "word", "প্রবন্ধ", "কবিতা", "story", "article", "লিখে"],
  research: ["গবেষণা", "research", "কুরআন", "কোরআন", "আয়াত", "আয়াত", "সূরা", "তথ্য", "বিশ্লেষণ"],
  learning: ["শেখা", "শিখবে", "বুদ্ধি", "স্মৃতি", "মেমোরি", "memory", "বুঝতে", "চিন্তা", "learning", "অনুধাবন"],
  plans: ["পরে", "পরবর্তী", "বাকি", "শেষ করুন", "চালিয়ে", "চালিয়ে", "আগামী", "পরিকল্পনা", "next step", "follow up"],
  devices: ["অ্যান্ড্রয়েড", "অ্যান্ড্রয়েড", "android", "ফোন", "ডিভাইস", "automation", "অটোমেশন", "permission", "পারমিশন"],
  voice: ["ভয়েস", "ভয়েস", "voice", "tts", "কণ্ঠ", "শুনুন", "উচ্চারণ"]
});
const SECRET_PATTERNS = [
  /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|passwd|secret|authorization)\s*[:=]\s*[^\s,;]+/gi,
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b/g
];
function cleanText(value) {
  let text = String(value ?? "").replace(/\u0000/g, "").trim();
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, "[secret redacted]");
  return text;
}
function keywords(text) {
  const stop = new Set(["এবং","কিন্তু","তাহলে","যেন","করে","করুন","করতে","আমার","তোমার","আপনি","একটা","একটি","যেটা","যেখানে","কেন","কীভাবে","হবে","হয়","হয়","the","and","for","with","that","this","from","what","when","how"]);
  return [...new Set((String(text).toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []).filter(w => !stop.has(w)))].slice(0, 80);
}
export function classifyMemoryTopics(text) {
  const value = String(text ?? "").toLowerCase();
  const found = Object.entries(MEMORY_TOPICS).map(([topic, terms]) => ({
    topic, score: terms.reduce((n, term) => n + (value.includes(term.toLowerCase()) ? 1 : 0), 0)
  })).filter(item => item.score > 0).sort((a,b) => b.score-a.score).map(item => item.topic);
  return found.length ? found.slice(0, 3) : ["general"];
}
function defaultId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "mem-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function makeRecord({ id, kind, role, text, conversationId, topics, now }) {
  const content = cleanText(text);
  if (!content) return null;
  const date = now().toISOString();
  const folders = (topics?.length ? topics : classifyMemoryTopics(content)).map(topic => "memory/" + topic + "/" + date.slice(0, 7));
  return { id: id(), kind, role, text: content, conversationId: String(conversationId || "default").slice(0, 120), topics: topics?.length ? topics : classifyMemoryTopics(content), folders, createdAt: date, updatedAt: date, keywords: keywords(content) };
}
function overlap(a, b) {
  const set = new Set(a);
  return b.reduce((n, word) => n + (set.has(word) ? 1 : 0), 0);
}
function extractStablePreference(text) {
  const value = String(text || "");
  const lower = value.toLowerCase();
  if (/(বর্তমানকে.{0,30}(ফলো|অগ্রাধিকার)|অতীতকে.{0,30}চাপিয়ে|current.{0,40}(override|priority)|old memories.{0,40}current)/i.test(value)) {
    return { key: "memory.current-first", value: "Latest user message and current conversation override older memories", scope: "interaction", source: "explicit", confidence: 1 };
  }
  if (/(বিষয়ভিত্তিক|বিষয়ভিত্তিক|ফোল্ডার ভিত্তিক|topic[- ]based).{0,50}(ফোল্ডার|folder|স্মৃতি|memory)/i.test(value)) {
    return { key: "memory.topic-folders", value: "Organize long-term memories by topic and timeline", scope: "interaction", source: "explicit", confidence: 1 };
  }
  const durable = /(আমার পছন্দ|আমি চাই তুমি|আমি চাই যে|সবসময়|সবসময়|always|i prefer|i want you to)/i.test(value);
  if (!durable) return null;
  if (/(ছোট|সংক্ষিপ্ত|short).{0,30}(উত্তর|লেখা|গল্প|বল|answer|response|story)/i.test(value)) {
    return { key: "writing.length", value: "Prefer concise responses unless the current request asks for more", scope: "writing", source: "explicit", confidence: 1 };
  }
  if (/(বড়|বড়|দীর্ঘ|বিস্তারিত|long|detailed).{0,30}(উত্তর|লেখা|গল্প|বল|answer|response|story)/i.test(value)) {
    return { key: "writing.length", value: "Prefer detailed responses when appropriate, while following the current request", scope: "writing", source: "explicit", confidence: 1 };
  }
  return null;
}
function summaryOf(records, maxChars = 1800) {
  const selected = records.slice(-8).map(item => (item.role === "user" ? "ব্যবহারকারী: " : "MOSHARROF AI: ") + item.text.replace(/\s+/g, " "));
  let summary = selected.join("\n");
  if (summary.length > maxChars) summary = "…"+summary.slice(-(maxChars-1));
  return summary;
}
export function createMemoryEngine({ store, now = () => new Date(), id = defaultId } = {}) {
  if (!store || typeof store.put !== "function" || typeof store.getAll !== "function" || typeof store.delete !== "function" || typeof store.clear !== "function") {
    throw new TypeError("memory store must implement put/getAll/delete/clear");
  }
  async function allRecords() { return (await store.getAll()).filter(x => x && typeof x.id === "string"); }
  async function recordMessage({ text, role = "user", conversationId = "default", topics } = {}) {
    if (!["user", "assistant"].includes(role)) throw new TypeError("role must be user or assistant");
    const item = makeRecord({ id, kind: "conversation-turn", role, text, conversationId, topics, now });
    if (!item) return null;
    await store.put(item);
    if (role === "user") {
      const preference = extractStablePreference(content);
      if (preference) await recordPreference(preference).catch(() => {});
    }
    return clone(item);
  }
  async function recordPreference({ key, value, scope = "global", source = "explicit", confidence = 1 } = {}) {
    const safeKey = cleanText(key).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 80);
    const safeValue = cleanText(value).slice(0, 1000);
    if (!safeKey || !safeValue) throw new TypeError("preference key and value are required");
    if (!["explicit", "corrected", "inferred"].includes(source)) throw new TypeError("invalid preference source");
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1 || (source === "inferred" && confidence < 0.75)) throw new RangeError("preference confidence is too low or invalid");
    const all = await allRecords();
    const current = all.find(x => x.kind === "preference" && x.key === safeKey && x.scope === scope);
    if (current && current.source !== "inferred" && source === "inferred") return { stored: false, reason: "explicit-preference-protected" };
    const date = now().toISOString();
    const item = { id: current?.id || id(), kind: "preference", key: safeKey, value: safeValue, scope, source, confidence, topics: ["preferences"], folders: ["memory/preferences"], createdAt: current?.createdAt || date, updatedAt: date, keywords: keywords(safeKey+" "+safeValue) };
    await store.put(item);
    return { stored: true, preference: clone(item) };
  }
  async function buildContext(currentText, conversationId = "default", { maxChars = 5000 } = {}) {
    const current = cleanText(currentText);
    const records = await allRecords();
    const turns = records.filter(x => x.kind === "conversation-turn").sort((a,b) => a.createdAt.localeCompare(b.createdAt));
    const active = turns.filter(x => x.conversationId === conversationId);
    const queryWords = keywords(current);
    const queryTopics = classifyMemoryTopics(current);
    const ranked = records.filter(x => x.kind === "conversation-turn" && x.conversationId !== conversationId)
      .map(item => {
        const topicScore = (item.topics || []).reduce((n,t) => n + (queryTopics.includes(t) ? 2 : 0), 0);
        const wordScore = overlap(queryWords, item.keywords || []);
        const ageDays = Math.max(0, (now().getTime() - Date.parse(item.createdAt)) / 86400000);
        const recency = Math.max(0, 1 - ageDays / 180);
        return { item, score: topicScore + wordScore + recency };
      }).filter(x => x.score >= 1.5).sort((a,b) => b.score-a.score || b.item.createdAt.localeCompare(a.item.createdAt));
    const preferences = records.filter(x => x.kind === "preference").sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
    const sections = [];
    if (preferences.length) sections.push("User-approved/observed preferences (preferences are not facts about unrelated topics):\n" + preferences.slice(0, 12).map(p => "- "+p.scope+"/"+p.key+": "+p.value+" ["+p.source+", confidence "+p.confidence+"]").join("\n"));
    if (active.length) sections.push("Current conversation summary (recent turns only):\n" + summaryOf(active));
    const relevant = ranked.slice(0, 8).map(x => x.item);
    if (relevant.length) sections.push("Relevant past memories (historical context; may be outdated):\n" + relevant.map(x => "- ["+x.createdAt.slice(0,10)+"; "+(x.topics||[]).join(", ")+"] "+x.role+": "+x.text.slice(0, 700)).join("\n"));
    const unfinished = relevant.filter(x => /বাকি|পরে|পরবর্তী|চালিয়ে|চালিয়ে|অসম্পূর্ণ|follow.?up|next step|unfinished/i.test(x.text));
    if (unfinished.length) sections.push("Possible follow-up cues (suggestions only; do not assume they are current commands):\n" + unfinished.slice(0,3).map(x => "- Check whether this earlier task is still active: "+x.text.slice(0,180)).join("\n"));
    sections.push("Memory policy: current user message and current conversation take priority. Past items are dated context, not current instructions. If a prior plan conflicts with the user's latest words, follow the latest words; mention old context only when relevant. Do not claim certainty about the user's thoughts or reveal private chain-of-thought.");
    let context = sections.join("\n\n");
    if (context.length > maxChars) context = context.slice(0, maxChars);
    return context;
  }
  async function listFolders() {
    const records = await allRecords(), folders = new Map();
    for (const item of records) for (const folder of item.folders || ["memory/general"]) folders.set(folder, (folders.get(folder)||0)+1);
    return [...folders.entries()].map(([path,count])=>({path,count})).sort((a,b)=>a.path.localeCompare(b.path));
  }
  async function exportAll() { return { schema: "mosharrof-personal-memory/v1", exportedAt: now().toISOString(), records: await allRecords() }; }
  return Object.freeze({
    recordMessage,
    recordPreference,
    buildContext,
    listFolders,
    listRecords: allRecords,
    exportAll,
    deleteRecord: id => store.delete(id),
    clearAll: () => store.clear()
  });
}
