/* Bridges local chronological memory to the live chat Worker without blocking streaming. */
import { createPersonalMemoryEngine } from "../core/personal-memory-engine.js";

export function installPersonalMemoryBridge(root = window) {
  if (root.__mosharrofMemoryBridgeInstalled) return root.MosharrofPersonalMemory || null;
  root.__mosharrofMemoryBridgeInstalled = true;
  const engine = createPersonalMemoryEngine({ root });
  root.MosharrofPersonalMemory = Object.freeze({
    enabled: engine.enabled,
    setEnabled: engine.setEnabled,
    list: engine.list,
    clear: engine.clear,
    recall: engine.recall
  });
  function installMemoryControls() {
    const drawer = root.document.getElementById("drawerRight") || root.document.getElementById("drawer-right");
    if (!drawer || drawer.querySelector("[data-personal-memory-controls]")) return;
    const section = root.document.createElement("section");
    section.className = "nav-family";
    section.dataset.personalMemoryControls = "true";
    section.style.cssText = "padding:14px;margin:10px;border:1px solid var(--border,rgba(255,255,255,.15));border-radius:14px";
    const title = root.document.createElement("div");
    title.className = "nav-family-title";
    title.textContent = "ব্যক্তিগত স্মৃতি";
    const note = root.document.createElement("p");
    note.textContent = "এই ব্রাউজার/ডিভাইসে কথোপকথন থেকে শেখা পছন্দ ও প্রাসঙ্গিক স্মৃতি রাখা হয়।";
    note.style.cssText = "font-size:12px;line-height:1.5;opacity:.8";
    const toggle = root.document.createElement("button");
    toggle.type = "button";
    toggle.style.cssText = "width:100%;padding:10px;margin:4px 0;border-radius:10px";
    const clear = root.document.createElement("button");
    clear.type = "button";
    clear.textContent = "সব স্মৃতি মুছুন";
    clear.style.cssText = toggle.style.cssText;
    function refresh() { toggle.textContent = "স্মৃতি সংরক্ষণ: " + (engine.enabled() ? "চালু" : "বন্ধ"); }
    toggle.addEventListener("click", function () { engine.setEnabled(!engine.enabled()); refresh(); });
    clear.addEventListener("click", async function () {
      if (!root.confirm("এই ডিভাইসে সংরক্ষিত সব ব্যক্তিগত স্মৃতি মুছে ফেলবেন?")) return;
      try { await engine.clear(); if (root.MosharrofToast) root.MosharrofToast("ব্যক্তিগত স্মৃতি মুছে ফেলা হয়েছে"); }
      catch (error) { console.error("[MOSHARROF Memory] Clear failed:", error); }
    });
    section.append(title, note, toggle, clear);
    drawer.appendChild(section);
    refresh();
  }
  if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", installMemoryControls, { once: true });
  else installMemoryControls();
  const originalFetch = root.fetch.bind(root);
  let sequence = Date.now();
  let previousId = null;
  root.fetch = async function(input, init) {
    let outgoing = init;
    let requestBody = null;
    let target = "";
    try {
      target = typeof input === "string" ? input : input?.url || "";
      if (init?.body && /\/chat(?:\?|$)/.test(new URL(target, root.location.href).pathname)) {
        requestBody = JSON.parse(init.body);
        if (requestBody && typeof requestBody.text === "string" && requestBody.text.trim()) {
          const memoryContext = await engine.buildContext(requestBody.text).catch(() => "");
          const saved = await engine.add({
            kind: "user", text: requestBody.text, sessionId: "mosharrof-chat",
            sequence: ++sequence, previousId
          }).catch(() => ({ stored: false }));
          if (saved.stored) previousId = saved.id;
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
            kind: "assistant", text: answer, sessionId: "mosharrof-chat",
            sequence: ++sequence, previousId
          }).catch(() => ({ stored: false }));
          if (saved.stored) previousId = saved.id;
        }
      }).catch(() => {});
    }
    return response;
  };
  return root.MosharrofPersonalMemory;
}
installPersonalMemoryBridge();
