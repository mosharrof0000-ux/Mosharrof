/** ChatGPT export + cross-topic memory UI; local-first, consent-gated. */
import { createPersonalMemoryEngine } from "./personal-memory-engine.js";
import { parseChatGPTExport, buildChatGPTStyleProfile } from "./chatgpt-conversation-import.js";

export function installKnowledgeContinuityBridge(root = globalThis) {
  if (!root?.document || !root.indexedDB || root.__mosharrofKnowledgeContinuityInstalled) return null;
  root.__mosharrofKnowledgeContinuityInstalled = true;
  const engine = createPersonalMemoryEngine({ root });
  const install = () => {
    const drawer = root.document.getElementById("drawerRight") || root.document.getElementById("drawer-right");
    if (!drawer || drawer.querySelector("[data-chatgpt-continuity]")) return;
    const section = root.document.createElement("section");
    section.dataset.chatgptContinuity = "true";
    section.style.cssText = "padding:14px;margin:10px;border:1px solid var(--border,rgba(255,255,255,.15));border-radius:14px";
    const title = root.document.createElement("strong"); title.textContent = "ChatGPT ↔ মোশাররফ স্মৃতি সংযোগ";
    const note = root.document.createElement("p");
    note.textContent = "ChatGPT-এর কথোপকথন নিজে থেকে পড়া যায় না। ChatGPT থেকে conversations.json export বেছে নিন; আগে প্রিভিউ দেখুন, তারপর আপনার অনুমতিতে এই ডিভাইসের স্মৃতিতে যোগ হবে।";
    note.style.cssText = "font-size:12px;line-height:1.5;opacity:.82;margin:8px 0";
    const picker = root.document.createElement("input"); picker.type = "file"; picker.accept = ".json,application/json";
    picker.setAttribute("aria-label", "ChatGPT conversations.json নির্বাচন");
    picker.style.cssText = "display:block;width:100%;font-size:12px;margin:8px 0";
    const preview = root.document.createElement("div"); preview.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.5;margin:8px 0";
    const importButton = root.document.createElement("button"); importButton.type = "button"; importButton.textContent = "প্রিভিউ দেখুন"; importButton.disabled = true;
    importButton.style.cssText = "width:100%;padding:10px;border-radius:10px;background:#202123;border:1px solid var(--border,rgba(255,255,255,.15))";
    const confirmButton = root.document.createElement("button"); confirmButton.type = "button"; confirmButton.textContent = "আমদানির অনুমতি দিন"; confirmButton.disabled = true;
    confirmButton.style.cssText = importButton.style.cssText + ";margin-top:6px";
    const query = root.document.createElement("input"); query.type = "search"; query.placeholder = "সব বিষয়ের স্মৃতিতে খুঁজুন…";
    query.style.cssText = "box-sizing:border-box;width:100%;padding:9px;margin:12px 0 4px;border-radius:8px";
    const matches = root.document.createElement("div"); matches.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.5;max-height:220px;overflow:auto";
    let pending = null, profileDraft = null;
    picker.addEventListener("change", async () => {
      pending = null; profileDraft = null; confirmButton.disabled = true; preview.textContent = "";
      const file = picker.files?.[0]; if (!file) return;
      try {
        const text = await file.text();
        if (file.size > 100 * 1024 * 1024) throw new RangeError("ফাইল ১০০ MB-এর বেশি; ছোট ব্যাচে export করুন।");
        pending = parseChatGPTExport(text);
        profileDraft = buildChatGPTStyleProfile(pending);
        preview.textContent = "প্রিভিউ (এখনো আমদানি হয়নি)\nকথোপকথন: " + pending.preview.conversations +
          "\nনির্বাচিত user/assistant বার্তা: " + pending.preview.importedTurns +
          "\nবাদ পড়া/ডুপ্লিকেট/সংবেদনশীল বার্তা: " + pending.preview.skippedTurns +
          "\n\nনমুনা:\n" + pending.entries.slice(0, 3).map(e => "[" + e.kind + "] " + e.text.slice(0, 180)).join("\n\n") +
          (profileDraft?.rules?.length ? "\n\nউত্তরের ধরন (খসড়া, স্বয়ংক্রিয়ভাবে চালু নয়):\n" + profileDraft.rules.map(r => "• " + r.value).join("\n") : "");
        importButton.disabled = false; confirmButton.disabled = false;
      } catch (error) { preview.textContent = "ফাইল পড়া যায়নি: " + String(error.message || error); }
    });
    importButton.addEventListener("click", () => { if (pending) preview.textContent = "প্রিভিউ প্রস্তুত। নিচের অনুমতি বোতাম চাপলে তবেই স্থানীয় স্মৃতিতে যোগ হবে।"; });
    confirmButton.addEventListener("click", async () => {
      if (!pending || !root.confirm("প্রিভিউতে দেখানো " + pending.preview.importedTurns + "টি ChatGPT বার্তা এই ডিভাইসের মোশাররফ স্মৃতিতে আমদানি করবেন?")) return;
      confirmButton.disabled = true;
      try {
        const result = await engine.importAll(pending);
        const count = typeof result === "number" ? result : (result?.imported ?? result?.count ?? pending.entries.length);
        if (profileDraft?.rules?.length) {
          await engine.add({ kind: "preference", folder: { id: "preferences", label: "পছন্দ ও আচরণ" },
            text: "ChatGPT উত্তর-শৈলী খসড়া (সম্পাদনা/পর্যালোচনা প্রয়োজন): " + profileDraft.rules.map(r => r.value).join(" ") });
        }
        preview.textContent += "\n\nআমদানি প্রক্রিয়া সম্পন্ন। ফলাফল: " + JSON.stringify(result ?? { attempted: pending.entries.length }) +
          "\nউৎস: ChatGPT export · ব্যাচ: " + pending.importBatchId +
          "\nনোট: ব্রাউজার স্টোরেজের নিরাপত্তা-ফিল্টার কিছু বার্তা বাদ দিতে পারে।";
        confirmButton.textContent = "আমদানি সম্পন্ন";
        pending = null;
        await root.MosharrofPersonalMemory?.search?.("ChatGPT কথোপকথন", 8);
      } catch (error) {
        preview.textContent += "\n\nআমদানি ব্যর্থ: " + String(error.message || error);
        confirmButton.disabled = false;
      }
    });
    query.addEventListener("input", async () => {
      const q = query.value.trim();
      if (!q) { matches.textContent = "স্মৃতি খুঁজতে লিখুন।"; return; }
      try {
        const rows = await engine.search(q, 12);
        matches.textContent = rows.length ? rows.map((r, i) => (i + 1) + ". [" + (r.folder?.label || r.kind || "স্মৃতি") + "] " + r.text + (r.source?.provider === "chatgpt" ? "\n   উৎস: ChatGPT · " + (r.source.conversationTitle || r.source.conversationId) : "")).join("\n\n") : "এই বিষয়ে সংরক্ষিত স্মৃতি পাওয়া যায়নি।";
      } catch (error) { matches.textContent = "স্মৃতি খোঁজা যায়নি: " + String(error.message || error); }
    });
    section.append(title, note, picker, preview, importButton, confirmButton, query, matches);
    drawer.appendChild(section);
  };
  if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", install, { once: true }); else install();
  return { search: (query, limit) => engine.search(query, limit), import: snapshot => engine.importAll(snapshot) };
}
if (typeof window !== "undefined") installKnowledgeContinuityBridge(window);
