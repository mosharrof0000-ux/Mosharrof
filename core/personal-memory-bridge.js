import "./knowledge-continuity-bridge.js";
/* Bridges local chronological memory to the live chat Worker without blocking streaming. */
import { createPersonalMemoryEngine } from "./personal-memory-engine.js";

export function installPersonalMemoryBridge(root = (typeof window !== "undefined" ? window : null)) {
  if (!root || !root.document || typeof root.fetch !== "function") return null;
  if (root.__mosharrofMemoryBridgeInstalled) return root.MosharrofPersonalMemory || null;
  root.__mosharrofMemoryBridgeInstalled = true;
  const engine = createPersonalMemoryEngine({ root });
  root.MosharrofPersonalMemory = Object.freeze({
    enabled: engine.enabled,
    setEnabled: engine.setEnabled,
    list: engine.list,
    clear: engine.clear,
    recall: engine.recall,
    search: engine.search,
    buildContext: engine.buildContext,
    timeline: engine.timeline,
    folders: engine.folders,
    listFolder: engine.listFolder,
    exportAll: engine.exportAll,
    importAll: engine.importAll
  });
  function installMemoryControls() {
    const drawer = root.document.getElementById("drawerRight") || root.document.getElementById("drawer-right");
    if (!drawer) return;
    if (drawer.querySelector("[data-personal-memory-controls]")) { root.__mosharrofRefreshMemoryFolders?.(); return; }
    const section = root.document.createElement("section");
    section.className = "nav-family";
    section.dataset.personalMemoryControls = "true";
    section.style.cssText = "padding:14px;margin:10px;border:1px solid var(--border,rgba(255,255,255,.15));border-radius:14px";
    const title = root.document.createElement("div");
    title.className = "nav-family-title";
    title.textContent = "ব্যক্তিগত স্মৃতি";
    const note = root.document.createElement("p");
    note.textContent = "বিষয়ভিত্তিক ফোল্ডার, সময়ক্রম ও প্রাসঙ্গিক স্মৃতি এই ডিভাইসে থাকে। বর্তমান নির্দেশ পুরোনো পছন্দের চেয়ে অগ্রাধিকার পাবে।";
    note.style.cssText = "font-size:12px;line-height:1.5;opacity:.8";
    const toggle = root.document.createElement("button");
    toggle.type = "button";
    toggle.style.cssText = "width:100%;padding:10px;margin:4px 0;border-radius:10px";
    const folder = root.document.createElement("select");
    folder.setAttribute("aria-label", "স্মৃতির বিষয়ভিত্তিক ফোল্ডার");
    folder.style.cssText = "width:100%;padding:9px;margin:6px 0;border-radius:8px";
    const search = root.document.createElement("input");
    search.type = "search";
    search.placeholder = "পুরোনো স্মৃতি খুঁজুন…";
    search.style.cssText = "box-sizing:border-box;width:100%;padding:9px;margin:4px 0;border-radius:8px";
    const results = root.document.createElement("div");
    results.style.cssText = "max-height:220px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.5;margin:8px 0";
    const exportButton = root.document.createElement("button");
    exportButton.type = "button";
    exportButton.textContent = "স্মৃতি রপ্তানি";
    exportButton.style.cssText = "width:100%;padding:10px;margin:4px 0;border-radius:10px";
    const clear = root.document.createElement("button");
    clear.type = "button";
    clear.textContent = "সব স্মৃতি মুছুন";
    clear.style.cssText = toggle.style.cssText;
    async function showRows(rows) {
      results.textContent = rows.length ? rows.map(function (item) {
        return "[" + new Date(item.createdAt).toLocaleString("bn-BD") + " · " + (item.folder?.label || item.kind) + "]\n" + item.text;
      }).join("\n\n") : "এই ফোল্ডারে এখনো কোনো স্মৃতি নেই।";
    }
    async function refreshFolders() {
      const items = await engine.folders();
      folder.textContent = "";
      items.forEach(function (item) {
        const option = root.document.createElement("option");
        option.value = item.id;
        option.textContent = item.label + " (" + item.count + ")";
        folder.appendChild(option);
      });
      if (items.length) await showRows(await engine.listFolder(folder.value, 40));
      else results.textContent = "এখনো কোনো স্মৃতি সংরক্ষিত নেই।";
    }
    root.__mosharrofRefreshMemoryFolders = refreshFolders;
    function refresh() { toggle.textContent = "স্মৃতি সংরক্ষণ: " + (engine.enabled() ? "চালু" : "বন্ধ"); }
    toggle.addEventListener("click", function () { engine.setEnabled(!engine.enabled()); refresh(); });
    folder.addEventListener("change", async function () { await showRows(await engine.listFolder(folder.value, 40)); });
    search.addEventListener("input", async function () {
      const query = search.value.trim();
      if (query) await showRows(await engine.search(query, 40));
      else if (folder.value) await showRows(await engine.listFolder(folder.value, 40));
    });
    exportButton.addEventListener("click", async function () {
      try {
        const snapshot = await engine.exportAll();
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
        const url = root.URL.createObjectURL(blob);
        const link = root.document.createElement("a");
        link.href = url; link.download = "mosharrof-personal-memory.json"; link.click();
        root.URL.revokeObjectURL(url);
      } catch (error) { console.error("[MOSHARROF Memory] Export failed:", error); }
    });
    clear.addEventListener("click", async function () {
      if (!root.confirm("এই ডিভাইসে সংরক্ষিত সব ব্যক্তিগত স্মৃতি মুছে ফেলবেন?")) return;
      try { await engine.clear(); await refreshFolders(); if (root.MosharrofToast) root.MosharrofToast("ব্যক্তিগত স্মৃতি মুছে ফেলা হয়েছে"); }
      catch (error) { console.error("[MOSHARROF Memory] Clear failed:", error); }
    });
    section.append(title, note, toggle, folder, search, results, exportButton, clear);
    drawer.appendChild(section);
    refresh();
    refreshFolders().catch(error => console.warn("[MOSHARROF Memory] Initial listing failed:", error));
  }
  if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", installMemoryControls, { once: true });
  else installMemoryControls();
  const originalFetch = root.fetch.bind(root);
  let sequence = Date.now();
  let previousId = null;
  let currentFolder = null;
  root.fetch = async function(input, init) {
    let outgoing = init;
    let requestBody = null;
    let target = "";
    try {
      target = typeof input === "string" ? input : input?.url || "";
      if (init?.body && /\/chat(?:\?|$)/.test(new URL(target, root.location.href).pathname)) {
        requestBody = JSON.parse(init.body);
        if (requestBody && typeof requestBody.text === "string" && requestBody.text.trim()) {
          currentFolder = engine.classifyFolder(requestBody.text);
          const memoryContext = await engine.buildContext(requestBody.text).catch(() => "");
          const saved = await engine.add({
            kind: "user", text: requestBody.text, folder: currentFolder, sessionId: "mosharrof-chat",
            sequence: ++sequence, previousId
          }).catch(() => ({ stored: false }));
          if (saved.stored) previousId = saved.id;
          installMemoryControls();
          outgoing = { ...init, body: JSON.stringify({ ...requestBody, memory_context: memoryContext }) };
        }
      }
    } catch (error) {
      console.warn("[MOSHARROF Memory] Could not prepare local context:", error?.message || error);
    }
    const response = await originalFetch(input, outgoing);
    if (requestBody) {
      response.clone().text().then(async bodyText => {
        let answer = "";
        try {
          const blocks = bodyText.split(/\r?\n\r?\n/);
          for (const block of blocks) {
            const line = block.split(/\r?\n/).find(value => value.startsWith("data: "));
            if (!line) continue;
            const event = JSON.parse(line.slice(6));
            if (event.type === "result" && event.status >= 200 && event.status < 300) answer = String(event.data?.text || "");
          }
          if (!answer && response.headers.get("content-type")?.includes("application/json")) {
            const data = JSON.parse(bodyText);
            if (data.ok) answer = String(data.text || "");
          }
        } catch { /* incomplete or non-chat stream */ }
        if (answer) {
          const saved = await engine.add({
            kind: "assistant", text: answer, folder: currentFolder, sessionId: "mosharrof-chat",
            sequence: ++sequence, previousId
          }).catch(() => ({ stored: false }));
          if (saved.stored) previousId = saved.id;
          await root.__mosharrofRefreshMemoryFolders?.();
        }
      }).catch(() => {});
    }
    return response;
  };
  return root.MosharrofPersonalMemory;
}
if (typeof window !== "undefined") installPersonalMemoryBridge();
