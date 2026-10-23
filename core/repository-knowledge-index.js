/**
 * Searchable, source-backed knowledge index for MOSHARROF repository files and reports.
 * This module never scans a repository itself; a trusted caller supplies records
 * from an authorized GitHub tree, file reader, or CI report API.
 */
const SECRET_PATH = /(^|\/)(\.env(?:\.|$)|secrets?(?:\/|\.|$)|credentials?(?:\/|\.|$)|id_rsa|.*\.pem$|.*\.key$)/i;
const SECRET_TEXT = /(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AIza[0-9A-Za-z_-]{30,})/;
const WORDS = /[\p{L}\p{N}_./-]{2,}/gu;

function words(value) {
  return String(value || "").toLocaleLowerCase().match(WORDS) || [];
}
function safePath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\.\//, "").slice(0, 500);
}
function classifyPath(path) {
  if (/^\.github\/workflows\//i.test(path)) return "workflow";
  if (/(^|\/)(tests?|__tests__)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/i.test(path)) return "test";
  if (/(report|artifact|health|status|checkpoint|incident|failure|summary)/i.test(path)) return "report";
  if (/\.(md|mdx|txt|rst)$/i.test(path)) return "documentation";
  if (/\.(ya?ml|json|toml)$/i.test(path)) return "configuration";
  if (/\.(mjs|cjs|js|ts|tsx|jsx|py|java|kt|go|rs)$/i.test(path)) return "source";
  return "file";
}

/** Build a bounded index from already-authorized repository/report records. */
export function buildRepositoryKnowledgeIndex(records, options = {}) {
  if (!Array.isArray(records)) throw new TypeError("Expected an array of repository knowledge records.");
  const maxRecords = Math.max(1, Math.min(100000, Number(options.maxRecords) || 50000));
  if (records.length > maxRecords) throw new RangeError("Repository knowledge index exceeds the configured record limit.");
  const indexedAt = options.indexedAt || new Date().toISOString();
  const seen = new Set();
  const entries = [];
  let skipped = 0;
  for (const record of records) {
    const path = safePath(record?.path || record?.filePath || "");
    const id = String(record?.id || path || record?.url || "").slice(0, 500);
    if (!id || seen.has(id) || SECRET_PATH.test(path)) { skipped++; continue; }
    const content = String(record?.content || record?.summary || "").slice(0, 12000);
    if (SECRET_TEXT.test(content)) { skipped++; continue; }
    seen.add(id);
    const kind = String(record?.kind || classifyPath(path)).slice(0, 80);
    const title = String(record?.title || path || kind).slice(0, 300);
    entries.push({
      id, path, title, kind,
      summary: String(record?.summary || "").slice(0, 1200),
      content,
      status: String(record?.status || "").slice(0, 80),
      updatedAt: record?.updatedAt || null,
      sourceUrl: /^https:\/\//i.test(String(record?.sourceUrl || record?.url || "")) ? String(record.sourceUrl || record.url).slice(0, 2000) : null,
      source: String(record?.source || "repository").slice(0, 80),
      indexedAt
    });
  }
  return { schemaVersion: 1, indexedAt, source: "mosharrof-repository-knowledge", entries, stats: { received: records.length, indexed: entries.length, skipped } };
}

/** Search names, summaries, content, status, and provenance; returns source-backed matches. */
export function searchRepositoryKnowledge(index, query, limit = 8) {
  if (!index || index.schemaVersion !== 1 || !Array.isArray(index.entries)) throw new TypeError("Unsupported repository knowledge index.");
  const queryWords = [...new Set(words(query))];
  if (!queryWords.length) return [];
  const max = Math.max(1, Math.min(50, Number(limit) || 8));
  return index.entries.map(entry => {
    const pathWords = words(entry.path + " " + entry.title);
    const bodyWords = words(entry.summary + " " + entry.content + " " + entry.kind + " " + entry.status);
    const pathSet = new Set(pathWords), bodySet = new Set(bodyWords);
    let score = 0;
    for (const word of queryWords) {
      if (pathSet.has(word)) score += 3;
      if (bodySet.has(word)) score += 1;
      if (String(entry.path).toLocaleLowerCase().includes(word)) score += 2;
    }
    return { ...entry, score: score / queryWords.length };
  }).filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, max);
}

/** A concise answer that preserves clickable evidence and explicitly reports uncertainty. */
export function formatRepositoryKnowledgeAnswer(matches, query) {
  if (!Array.isArray(matches) || !matches.length) {
    return { answer: "এই প্রশ্নের জন্য সূচিবদ্ধ ফাইল বা রিপোর্টে প্রমাণ পাওয়া যায়নি। আরও ফাইল/রিপোর্ট সূচিবদ্ধ করতে হবে।", sources: [], verified: false, query: String(query || "") };
  }
  const sources = matches.map(item => ({ title: item.title, path: item.path, url: item.sourceUrl, kind: item.kind, status: item.status, updatedAt: item.updatedAt }));
  const lines = matches.slice(0, 8).map((item, i) => {
    const excerpt = (item.summary || item.content || item.status || "ফাইলের নাম ও অবস্থান পাওয়া গেছে।").replace(/\s+/g, " ").slice(0, 360);
    return (i + 1) + ". " + item.title + (item.status ? " [" + item.status + "]" : "") + "\n   " + excerpt + (item.sourceUrl ? "\n   প্রমাণ: " + item.sourceUrl : item.path ? "\n   পথ: " + item.path : "");
  });
  return {
    answer: "সূচিবদ্ধ উৎস থেকে প্রাসঙ্গিক তথ্য:\n" + lines.join("\n"),
    sources,
    verified: matches.every(item => !!item.sourceUrl),
    note: "এটি সূচিবদ্ধ উৎসের সারাংশ; সর্বশেষ রান/লাইভ অবস্থা জানতে নতুন করে সংশ্লিষ্ট উৎস যাচাই করতে হবে।",
    query: String(query || "")
  };
}
