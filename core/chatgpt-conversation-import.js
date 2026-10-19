/**
 * ChatGPT export importer for MOSHARROF personal memory.
 * Accepts a user-selected ChatGPT conversations.json export; never scrapes ChatGPT.
 * Imports visible user/assistant text only, not system/developer/tool/reasoning records.
 */
const MAX_TURNS = 20000;
const MAX_TEXT_LENGTH = 4000;
const SECRET = /(password|passcode|\botp\b|verification code|credit card|debit card|cvv|পাসওয়ার্ড|পাসওয়ার্ড|ওটিপি|পিন কোড|কার্ড নম্বর|সিভিভি)/i;
const SENSITIVE = /(diagnos(ed|is)|medical record|sexual|sex life|political party|জাতীয় পরিচয়পত্র|জাতীয় পরিচয়পত্র|রোগ নির্ণয়|রোগ নির্ণয়|যৌন জীবন)/i;

function textFromMessage(message) {
  const content = message?.content;
  if (!content || !Array.isArray(content.parts)) return "";
  const visible = content.parts.filter(part => typeof part === "string");
  return visible.join("\n").replace(/\u0000/g, "").trim().slice(0, MAX_TEXT_LENGTH);
}
function asMillis(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return Date.now();
  return n < 100000000000 ? Math.round(n * 1000) : Math.round(n);
}
function safeImportText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || SECRET.test(text) || SENSITIVE.test(text)) return "";
  return text.slice(0, MAX_TEXT_LENGTH);
}

/**
 * Convert the standard ChatGPT conversations.json export into the existing
 * personal-memory-engine schemaVersion=1 snapshot. Preview this snapshot before
 * calling engine.importAll(snapshot).
 */
export function parseChatGPTExport(input, options = {}) {
  let data = input;
  if (typeof input === "string") {
    try { data = JSON.parse(input); }
    catch { throw new TypeError("ChatGPT export is not valid JSON."); }
  }
  const conversations = Array.isArray(data) ? data : data?.conversations;
  if (!Array.isArray(conversations)) throw new TypeError("Expected a ChatGPT conversations.json export.");
  const entries = [];
  const seen = new Set();
  let skipped = 0;
  const batchId = String(options.batchId || "chatgpt-import-" + Date.now()).slice(0, 100);
  for (const conversation of conversations) {
    const conversationId = String(conversation?.conversation_id || conversation?.id || "conversation-" + entries.length).slice(0, 160);
    const nodes = Object.values(conversation?.mapping || {})
      .map(node => node?.message)
      .filter(message => message && ["user", "assistant"].includes(message.author?.role))
      .sort((a, b) => asMillis(a.create_time) - asMillis(b.create_time));
    for (let index = 0; index < nodes.length; index++) {
      if (entries.length >= MAX_TURNS) throw new RangeError("Export exceeds the 20,000-turn preview limit; split the export into smaller batches.");
      const message = nodes[index];
      const text = safeImportText(textFromMessage(message));
      if (!text) { skipped++; continue; }
      const sourceId = String(message.id || index).slice(0, 160);
      const id = "chatgpt-" + conversationId + "-" + sourceId;
      if (seen.has(id)) { skipped++; continue; }
      seen.add(id);
      const createdAt = asMillis(message.create_time);
      entries.push({
        id,
        kind: message.author.role,
        text,
        createdAt,
        isoTime: new Date(createdAt).toISOString(),
        sessionId: conversationId,
        sequence: createdAt * 100 + index,
        tags: ["provider-chatgpt", "user-approved-import", batchId],
        folder: { id: "ai-conversation-history", label: "ChatGPT কথোপকথন" },
        previousId: null,
        preferences: [],
        source: {
          provider: "chatgpt",
          conversationId,
          conversationTitle: String(conversation.title || "ChatGPT conversation").slice(0, 200),
          messageId: sourceId,
          captureMethod: "user-export-import",
          importBatchId: batchId
        }
      });
    }
  }
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    sourceProvider: "chatgpt",
    importBatchId: batchId,
    entries,
    preview: {
      conversations: conversations.length,
      importedTurns: entries.length,
      skippedTurns: skipped,
      requiresUserConfirmation: true
    }
  };
}

/**
 * Build an editable style profile from visible assistant answers only.
 * This describes observable formatting, not hidden reasoning or model internals.
 */
export function buildChatGPTStyleProfile(snapshot) {
  const answers = (snapshot?.entries || []).filter(row => row.kind === "assistant" && typeof row.text === "string");
  if (answers.length < 3) {
    return { schemaVersion: 1, sourceProvider: "chatgpt", sampleCount: answers.length, status: "needs-more-examples", rules: [] };
  }
  const joined = answers.map(row => row.text).join("\n");
  const count = pattern => (joined.match(pattern) || []).length;
  const rules = [];
  if (count(/[\u0980-\u09FF]/g) >= 3) rules.push({ key: "language", value: "Use Bengali when the user writes in Bengali; preserve useful English technical terms." });
  if (count(/^\s*(?:[-*•]|\d+[.)])\s+/gm) >= 3) rules.push({ key: "structure", value: "Use clear lists and numbered steps for actionable work." });
  if (count(/^\s*#{1,6}\s+/gm) >= 2) rules.push({ key: "headings", value: "Use concise headings to organize multi-part answers." });
  if (count(/\|[^\n]+\|/g) >= 2) rules.push({ key: "tables", value: "Use tables for compact comparisons when they improve clarity." });
  if (count(/\p{Extended_Pictographic}/gu) >= 3) rules.push({ key: "icons", value: "Use icons sparingly to make statuses and key actions easier to scan." });
  return {
    schemaVersion: 1,
    sourceProvider: "chatgpt",
    sampleCount: answers.length,
    status: "draft-user-review-required",
    generatedAt: new Date().toISOString(),
    rules,
    notice: "Observable style suggestions only. Review and edit before enabling; no hidden reasoning or system prompts are inferred."
  };
}
