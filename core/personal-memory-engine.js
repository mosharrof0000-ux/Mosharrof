/**
 * Personal Intelligence & Memory Engine.
 * Stores an append-only, ordered memory ledger through an injected storage adapter.
 * "Unlimited" means no artificial entry-count cap; real storage quotas still apply.
 */
const SCHEMA_VERSION = 1;
const DEFAULT_NAMESPACE = "mosharrof.personal-memory.v1";
const MAX_CONTEXT_CHARS = 9000;
const CATEGORIES = new Set(["preference", "goal", "project", "correction", "decision", "fact", "open_question", "plan", "hypothesis", "event", "commitment"]);
const STATUSES = new Set(["active", "pending_confirmation", "superseded", "resolved", "archived"]);
const SECRET_LIKE = /(password|passcode|\\bpin\\b|\\botp\\b|api[_ -]?key|access[_ -]?token|secret|verification code|পাসওয়ার্ড|পাসওয়ার্ড|ওটিপি|পিন কোড|কার্ড নম্বর|cvv)/i;
const clean = (value, limit = 2000) => String(value ?? "").replace(/\u0000/g, "").trim().slice(0, limit);
const safeTime = value => {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
};
const clone = value => JSON.parse(JSON.stringify(value));

export function createPersonalMemoryEngine({ storage, namespace = DEFAULT_NAMESPACE, now = () => new Date().toISOString() } = {}) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new TypeError("A persistent storage adapter is required.");
  }
  const key = clean(namespace, 160);
  function readLedger() {
    const raw = storage.getItem(key);
    if (!raw) return { schema_version: SCHEMA_VERSION, revision: 0, memories: [] };
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.schema_version !== SCHEMA_VERSION || !Array.isArray(parsed.memories)) throw new Error("schema");
      return { schema_version: SCHEMA_VERSION, revision: Number(parsed.revision) || 0, memories: parsed.memories.filter(m => m && typeof m === "object") };
    } catch {
      throw new Error("Personal memory ledger is unreadable; export or recover it before writing.");
    }
  }
  function save(ledger) {
    ledger.revision += 1;
    ledger.updated_at = safeTime(now());
    storage.setItem(key, JSON.stringify(ledger));
    return { revision: ledger.revision, count: ledger.memories.length };
  }
  function remember(input) {
    if (!input || typeof input !== "object") throw new TypeError("Memory entry must be an object.");
    const content = clean(input.content, 4000);
    if (!content) throw new TypeError("Memory content is required.");
    const category = CATEGORIES.has(input.category) ? input.category : "fact";
    const ledger = readLedger();
    const entry = {
      id: clean(input.id, 120) || "mem-" + clean(now(), 40) + "-" + (ledger.revision + 1),
      category,
      content,
      confidence: Math.max(0, Math.min(1, Number(input.confidence ?? 0.65) || 0)),
      source: clean(input.source || "conversation", 80),
      status: ["active", "superseded", "resolved"].includes(input.status) ? input.status : "active",
      created_at: safeTime(input.created_at || now()),
      updated_at: safeTime(now()),
      relates_to: Array.isArray(input.relates_to) ? input.relates_to.map(v => clean(v, 120)).filter(Boolean).slice(0, 20) : [],
      user_confirmed: input.user_confirmed === true
    };
    // Do not discard earlier thoughts: append revisions and link the previous entry.
    if (input.supersedes) {
      const previous = ledger.memories.find(m => m.id === input.supersedes);
      if (previous) previous.status = "superseded";
    }
    ledger.memories.push(entry);
    return { ...save(ledger), entry: clone(entry) };
  }
  function revise(id, patch = {}) {
    const ledger = readLedger();
    const old = ledger.memories.find(m => m.id === clean(id, 120));
    if (!old) return null;
    old.status = "superseded";
    const result = remember({ ...old, ...patch, id: undefined, supersedes: old.id, created_at: now() });
    return result;
  }
  function recall({ category, query, includeSuperseded = false, limit } = {}) {
    const ledger = readLedger();
    const terms = clean(query, 300).toLowerCase().split(/\s+/).filter(Boolean);
    let items = ledger.memories.filter(m => (includeSuperseded || m.status !== "superseded") && (!category || m.category === category));
    if (terms.length) items = items.map(m => ({ m, score: terms.reduce((n, term) => n + (String(m.content).toLowerCase().includes(term) ? 1 : 0), 0) }))
      .filter(x => x.score > 0).sort((a, b) => b.score - a.score || String(b.m.created_at).localeCompare(String(a.m.created_at))).map(x => x.m);
    else items.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    const count = Number.isInteger(limit) && limit > 0 ? limit : items.length;
    return { revision: ledger.revision, total: ledger.memories.length, items: clone(items.slice(0, count)) };
  }
  function timeline({ includeSuperseded = true, category, after, before, limit, offset = 0 } = {}) {
    const ledger = readLedger();
    let items = ledger.memories.filter(m => (includeSuperseded || !["superseded", "archived"].includes(m.status)) && (!category || m.category === category) && (!after || Date.parse(m.created_at) >= Date.parse(after)) && (!before || Date.parse(m.created_at) <= Date.parse(before)));
    items.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));
    const start = Math.max(0, Number(offset) || 0);
    const end = Number.isInteger(limit) && limit > 0 ? start + limit : items.length;
    return { total: items.length, offset: start, items: clone(items.slice(start, end)) };
  }
  function exportAll() { return clone(readLedger()); }
  function importAll(snapshot) {
    if (!snapshot || snapshot.schema_version !== SCHEMA_VERSION || !Array.isArray(snapshot.memories)) throw new TypeError("Unsupported memory export.");
    const ledger = readLedger();
    const known = new Set(ledger.memories.map(m => m.id));
    for (const item of snapshot.memories) if (item && typeof item === "object" && item.id && !known.has(item.id)) {
      ledger.memories.push({ ...item, content: clean(item.content, 4000), category: CATEGORIES.has(item.category) ? item.category : "fact" });
      known.add(item.id);
    }
    return save(ledger);
  }
  function clear() {
    if (typeof storage.removeItem !== "function") throw new TypeError("Storage adapter does not support deletion.");
    storage.removeItem(key);
    return true;
  }
  return Object.freeze({ remember, revise, recall, timeline, exportAll, importAll, clear });
}

export function buildPersonalMemoryContext(profile, currentText = "") {
  if (!profile || typeof profile !== "object") return "";
  const entries = Array.isArray(profile.memories) ? profile.memories : Array.isArray(profile.items) ? profile.items : [];
  const current = clean(currentText, 1500).toLowerCase();
  const terms = current.split(/[^\p{L}\p{N}]+/u).filter(t => t.length > 2);
  const ranked = entries.filter(m => m && typeof m === "object" && m.status !== "superseded")
    .map((m, index) => {
      const content = clean(m.content, 1000);
      const lower = content.toLowerCase();
      const overlap = terms.reduce((n, term) => n + (lower.includes(term) ? 1 : 0), 0);
      const recency = Number.isFinite(Date.parse(m.updated_at || m.created_at)) ? Date.parse(m.updated_at || m.created_at) / 1e13 : 0;
      const score = (m.user_confirmed ? 8 : 0) + overlap * 3 + (m.category === "preference" ? 2 : 0) + recency;
      return { m, content, score, index };
    }).filter(x => x.content).sort((a, b) => b.score - a.score || b.index - a.index);
  const selected = [];
  let used = 0;
  for (const item of ranked) {
    const line = "- [" + clean(item.m.category || "fact", 40) + "; confidence " + Math.max(0, Math.min(1, Number(item.m.confidence ?? 0.6))) + "] " + item.content;
    if (used + line.length > MAX_CONTEXT_CHARS) continue;
    selected.push(line);
    used += line.length;
  }
  if (!selected.length) return "";
  return [
    "USER PERSONAL MEMORY (user-provided/previously approved context; may be incomplete or outdated):",
    "Use relevant memories to adapt helpfully. Confirm important or high-impact assumptions instead of treating guesses as facts.",
    "Consider temporal order: distinguish past events, current goals, future plans, and open questions. Use valid_from/valid_until and supersedes links when present; never treat a superseded belief or plan as current.",
    "Offer a concise next-step forecast only when supported by saved goals/events, label it as a possibility, and ask when conflicting timelines materially change the answer.",
    "Do not infer private traits beyond the evidence, do not pretend to read minds, and let the user's current instruction override older preferences.",
    ...selected
  ].join("\n");
}

export function inferMemoryCandidates(userText, assistantText = "") {
  const text = clean(userText, 4000);
  if (!text) return [];
  const lower = text.toLowerCase();
  const explicitPreference = /(মনে রাখ|ভবিষ্যতে|পরের বার|সবসময়|সব সময়|আমার পছন্দ|আমি চাই|i prefer|remember that|from now on|always)/i.test(text);
  const correction = /(না,? এভাবে নয়|এভাবে না|আরও বড়|আরও ছোট|বিস্তারিত কর|সংক্ষিপ্ত কর|that's not|instead|make it longer|make it shorter)/i.test(text);
  const goal = /(লক্ষ্য|পরিকল্পনা|তৈরি করছি|বাস্তবায়ন|বাস্তবায়ন|i am building|my goal|plan to)/i.test(text);
  if (!explicitPreference && !correction && !goal) return [];
  return [{
    category: correction ? "correction" : explicitPreference ? "preference" : "goal",
    content: text,
    confidence: explicitPreference ? 0.9 : correction ? 0.82 : 0.7,
    source: "conversation_candidate",
    status: "pending_confirmation",
    user_confirmed: false,
    rationale: "Candidate extracted from explicit wording; store only after user consent or client-side review."
  }];
}
