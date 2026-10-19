/** User-approved ChatGPT export parser for MOSHARROF memory. Never scrapes ChatGPT. */
const MAX_TURNS = 20000;
const MAX_TEXT_LENGTH = 4000;
const SECRET = /(password|passcode|\\botp\\b|verification code|credit card|debit card|cvv|পাসওয়ার্ড|পাসওয়ার্ড|ওটিপি|পিন কোড|কার্ড নম্বর|সিভিভি)/i;
const SENSITIVE = /(diagnos(ed|is)|medical record|sexual|sex life|political party|জাতীয় পরিচয়পত্র|জাতীয় পরিচয়পত্র|রোগ নির্ণয়|রোগ নির্ণয়|যৌন জীবন)/i;
function textFromMessage(message) {
  const parts = message?.content?.parts;
  return Array.isArray(parts) ? parts.filter(part => typeof part === "string").join("\\n").replace(/\\u0000/g, "").trim().slice(0, MAX_TEXT_LENGTH) : "";
}
function asMillis(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return Date.now();
  return n < 100000000000 ? Math.round(n * 1000) : Math.round(n);
}
function safeImportText(value) {
  const text = String(value || "").replace(/\\s+/g, " ").trim();
  if (!text || SECRET.test(text) || SENSITIVE.test(text)) return "";
  return text.slice(0, MAX_TEXT_LENGTH);
}
/** Parse a standard conversations.json export; caller must show preview and ask consent. */
export function parseChatGPTExport(input, options = {}) {
  let data = input;
  if (typeof input === "string") { try { data = JSON.parse(input); } catch { throw new TypeError("ChatGPT export is not valid JSON."); } }
  const conversations = Array.isArray(data) ? data : data?.conversations;
  if (!Array.isArray(conversations)) throw new TypeError("Expected a ChatGPT conversations.json export.");
  const entries = [], seen = new Set();
  let skipped = 0;
  const batchId = String(options.batchId || "chatgpt-import-" + Date.now()).slice(0, 100);
  for (const conversation of conversations) {
    const conversationId = String(conversation?.conversation_id || conversation?.id || "conversation-" + entries.length).slice(0, 160);
    const messages = Object.values(conversation?.mapping || {}).map(node => node?.message)
      .filter(message => message && ["user", "assistant"].includes(message.author?.role))
      .sort((a, b) => asMillis(a.create_time) - asMillis(b.create_time));
    for (let i = 0; i < messages.length; i++) {
      if (entries.length >= MAX_TURNS) throw new RangeError("Export exceeds 20,000 turns; split it into smaller batches.");
      const message = messages[i], text = safeImportText(textFromMessage(message));
      if (!text) { skipped++; continue; }
      const messageId = String(message.id || i).slice(0, 160), id = "chatgpt-" + conversationId + "-" + messageId;
      if (seen.has(id)) { skipped++; continue; }
      seen.add(id);
      const createdAt = asMillis(message.create_time);
      entries.push({
        id, kind: message.author.role, text, createdAt, isoTime: new Date(createdAt).toISOString(),
        sessionId: conversationId, sequence: createdAt * 100 + i,
        tags: ["provider-chatgpt", "user-approved-import", batchId],
        folder: { id: "ai-conversation-history", label: "ChatGPT কথোপকথন" },
        previousId: null, preferences: [],
        source: { provider: "chatgpt", conversationId,
          conversationTitle: String(conversation.title || "ChatGPT conversation").slice(0, 200),
          messageId, captureMethod: "user-export-import", importBatchId: batchId }
      });
    }
  }
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), sourceProvider: "chatgpt",
    importBatchId: batchId, entries,
    preview: { conversations: conversations.length, importedTurns: entries.length, skippedTurns: skipped, requiresUserConfirmation: true } };
}
export function buildChatGPTStyleProfile(snapshot) {
  const answers = (snapshot?.entries || []).filter(row => row.kind === "assistant" && typeof row.text === "string");
  if (answers.length < 3) return { schemaVersion: 1, sourceProvider: "chatgpt", sampleCount: answers.length, status: "needs-more-examples", rules: [] };
  const joined = answers.map(row => row.text).join("\\n"), count = re => (joined.match(re) || []).length, rules = [];
  if (count(/[\\u0980-\\u09FF]/g) >= 3) rules.push({ key: "language", value: "বাংলায় প্রশ্ন করলে বাংলায় উত্তর দিন; দরকারি ইংরেজি প্রযুক্তিগত শব্দ রাখুন।" });
  if (count(/^\\s*(?:[-*•]|\\d+[.)])\\s+/gm) >= 3) rules.push({ key: "structure", value: "কাজের নির্দেশে পরিষ্কার তালিকা ও ধাপ ব্যবহার করুন।" });
  if (count(/^\\s*#{1,6}\\s+/gm) >= 2) rules.push({ key: "headings", value: "বহু অংশের উত্তরে সংক্ষিপ্ত শিরোনাম ব্যবহার করুন।" });
  return { schemaVersion: 1, sourceProvider: "chatgpt", sampleCount: answers.length,
    status: "draft-user-review-required", generatedAt: new Date().toISOString(), rules,
    notice: "এটি দৃশ্যমান উত্তরের ধরন থেকে তৈরি সম্পাদনাযোগ্য খসড়া; অনুমোদন ছাড়া সক্রিয় হবে না।" };
}
