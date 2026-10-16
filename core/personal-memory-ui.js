/* Visible controls for the local personal memory engine. */
(function (root) {
  "use strict";
  let panelOpen = false;
  let api = null;
  function downloadExport(rows) {
    const blob = new Blob([JSON.stringify({ schema: "mosharrof-memory-v1", exportedAt: new Date().toISOString(), memories: rows }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "mosharrof-memory-export.json"; a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function el(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  async function renderPanel(panel) {
    panel.replaceChildren();
    const head = el("div", "ব্যক্তিগত স্মৃতি");
    head.style.cssText = "font-weight:700;font-size:16px;margin-bottom:8px";
    const desc = el("p", "বিষয়ভিত্তিক স্মৃতি এই ডিভাইসের ব্রাউজারে থাকে। বর্তমান অনুরোধ সবসময় পুরোনো স্মৃতির চেয়ে অগ্রাধিকার পাবে।");
    desc.style.cssText = "font-size:12px;line-height:1.5;margin:0 0 10px";
    const toggle = el("button", api.api.api.enabled() ? "স্মৃতি চালু আছে — বন্ধ করুন" : "স্মৃতি বন্ধ — চালু করুন");
    toggle.type = "button"; toggle.onclick = function () { api.setEnabled(!api.api.enabled()); renderPanel(panel); };
    toggle.style.cssText = "padding:8px;border-radius:10px;border:1px solid #888;background:transparent;color:inherit;width:100%;margin-bottom:8px";
    panel.append(head, desc, toggle);
    let rows = [];
    try { rows = await api.list(); } catch (e) { panel.append(el("p", "স্মৃতি খুলতে সমস্যা: " + String(e.message || e))); return; }
    const count = el("div", "মোট স্মৃতি: " + rows.length + " · বিষয়ভিত্তিক ফোল্ডার: " + new Set(rows.map(r => r.topic)).size);
    count.style.cssText = "font-size:12px;margin:6px 0 10px";
    panel.append(count);
    const groups = new Map();
    rows.forEach(row => { if (!groups.has(row.topic)) groups.set(row.topic, []); groups.get(row.topic).push(row); });
    groups.forEach((items, topic) => {
      const details = el("details"); details.style.marginBottom = "6px";
      const summary = el("summary", topic + " (" + items.length + ")"); summary.style.cursor = "pointer";
      details.append(summary);
      items.slice(0, 30).forEach(row => {
        const wrap = el("div"); wrap.style.cssText = "border-top:1px solid #8884;padding:7px 0;font-size:12px";
        const txt = el("div", row.text); txt.style.whiteSpace = "pre-wrap";
        const meta = el("div", new Date(row.updatedAt).toLocaleString() + " · " + (row.tags || []).join(", "));
        meta.style.cssText = "opacity:.7;font-size:10px;margin:4px 0";
        const del = el("button", "এই স্মৃতি মুছুন"); del.type = "button"; del.style.cssText = "font-size:11px;padding:3px 7px";
        del.onclick = async function () { await api.remove(row.id); await renderPanel(panel); };
        wrap.append(txt, meta, del); details.append(wrap);
      });
      panel.append(details);
    });
    const actions = el("div"); actions.style.cssText = "display:flex;gap:6px;margin-top:10px";
    const exportBtn = el("button", "Export"); exportBtn.type = "button"; exportBtn.onclick = async function () { downloadExport(await api.list()); };
    const clearBtn = el("button", "সব মুছুন"); clearBtn.type = "button"; clearBtn.onclick = async function () {
      if (root.confirm("সব সংরক্ষিত স্মৃতি মুছে ফেলবেন?")) { await api.clear(); await renderPanel(panel); }
    };
    [exportBtn, clearBtn].forEach(b => { b.style.cssText = "flex:1;padding:7px;border-radius:8px;border:1px solid #888;background:transparent;color:inherit"; });
    actions.append(exportBtn, clearBtn); panel.append(actions);
  }
  function updatePanel() {
    const button = document.getElementById("mosharrof-memory-toggle");
    if (button) button.textContent = api.api.api.enabled() ? "🧠 স্মৃতি" : "🧠 স্মৃতি বন্ধ";
  }
  function mountUi() {
    if (!root.document || document.getElementById("mosharrof-memory-toggle")) return;
    const button = el("button", api.api.api.enabled() ? "🧠 স্মৃতি" : "🧠 স্মৃতি বন্ধ");
    button.id = "mosharrof-memory-toggle"; button.type = "button";
    button.style.cssText = "position:fixed;right:12px;top:70px;z-index:99990;border:1px solid #8888;border-radius:18px;padding:7px 10px;background:Canvas;color:CanvasText;font:12px system-ui;box-shadow:0 2px 8px #0002";
    const panel = el("section");
    panel.id = "mosharrof-memory-panel";
    panel.style.cssText = "display:none;position:fixed;right:12px;top:108px;z-index:99991;width:min(360px,calc(100vw - 24px));max-height:70vh;overflow:auto;padding:12px;border:1px solid #8888;border-radius:14px;background:Canvas;color:CanvasText;box-shadow:0 8px 28px #0003;font:14px system-ui";
    button.onclick = async function () {
      panelOpen = !panelOpen; panel.style.display = panelOpen ? "block" : "none";
      if (panelOpen) await renderPanel(panel);
    };
    document.body.append(button, panel);
  }

  root.MosharrofMemoryUI = Object.freeze({
    mount: function (memoryApi) { api = memoryApi; mountUi(); },
    updatePanel
  });
})(typeof window !== "undefined" ? window : globalThis);
