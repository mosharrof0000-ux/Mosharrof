export function installMemoryControls(engine, options = {}) {
  if (typeof document === "undefined" || document.getElementById("mosharrof-memory-button")) return;
  const composer = document.getElementById("composer"), send = document.getElementById("sendBtn");
  if (!composer || !send) return;
  const button = document.createElement("button");
  button.type = "button"; button.id = "mosharrof-memory-button"; button.className = "composer-action";
  button.title = "ব্যক্তিগত স্মৃতি"; button.setAttribute("aria-label", "ব্যক্তিগত স্মৃতি পরিচালনা");
  button.textContent = "🧠";
  send.parentNode.insertBefore(button, send);
  const panel = document.createElement("section");
  panel.id = "mosharrof-memory-panel";
  panel.style.cssText = "display:none;position:fixed;z-index:20001;inset:8% 5%;overflow:auto;background:#101010;color:#f5f5f5;border:1px solid #444;border-radius:16px;padding:18px;font:14px/1.6 system-ui;box-shadow:0 10px 40px #000";
  panel.innerHTML = '<div style="display:flex;gap:8px;align-items:center"><strong style="flex:1">ব্যক্তিগত স্মৃতি</strong><button type="button" data-memory-close>বন্ধ</button></div><p data-memory-status>স্মৃতি প্রস্তুত হচ্ছে…</p><p>স্মৃতি বিষয়ভিত্তিক ফোল্ডারে এই ডিভাইসের ব্রাউজারে থাকে। কোনো নির্দিষ্ট আইটেম-সংখ্যার সীমা নেই; ডিভাইসের স্টোরেজ-সীমা প্রযোজ্য।</p><label style="display:block;margin:10px 0"><input type="checkbox" data-memory-enabled checked> নতুন কথোপকথন স্মৃতিতে রাখুন</label><div data-memory-folders></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button type="button" data-memory-export>স্মৃতি রপ্তানি</button><button type="button" data-memory-import>স্মৃতি আমদানি</button><button type="button" data-memory-clear>সব স্মৃতি মুছুন</button><input type="file" data-memory-file accept="application/json" hidden></div><p style="color:#aaa;font-size:12px;margin-top:12px">পুরোনো স্মৃতি বর্তমান নির্দেশের ওপর প্রাধান্য পাবে না। রপ্তানি ফাইলে আপনার কথোপকথন থাকতে পারে—নিরাপদে রাখুন।</p>';
  document.body.appendChild(panel);
  const status = panel.querySelector("[data-memory-status]"), folders = panel.querySelector("[data-memory-folders]"), enabled = panel.querySelector("[data-memory-enabled]"), file = panel.querySelector("[data-memory-file]");
  enabled.checked = options.isEnabled?.() !== false;
  enabled.addEventListener("change", () => options.setEnabled?.(enabled.checked));
  async function refresh() {
    try {
      const stats = await engine.stats();
      status.textContent = "স্মৃতি: " + stats.count + "টি | অবস্থা: " + (enabled.checked ? "চালু" : "বন্ধ");
      folders.replaceChildren();
      for (const item of stats.folders) {
        const row = document.createElement("p"); row.textContent = item.folder + " — " + item.count + "টি"; folders.appendChild(row);
      }
      if (!stats.folders.length) folders.textContent = "এখনো কোনো স্মৃতি নেই।";
    } catch (error) { status.textContent = "স্মৃতি পড়া যায়নি: " + String(error.message || error); }
  }
  button.addEventListener("click", () => { panel.style.display = "block"; refresh(); });
  panel.querySelector("[data-memory-close]").addEventListener("click", () => { panel.style.display = "none"; });
  panel.querySelector("[data-memory-export]").addEventListener("click", async () => {
    const bundle = await engine.exportAll(), blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = "mosharrof-memory-export.json"; anchor.click(); URL.revokeObjectURL(url);
  });
  panel.querySelector("[data-memory-import]").addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    const selected = file.files?.[0]; if (!selected) return;
    try { const result = await engine.importAll(JSON.parse(await selected.text())); status.textContent = "আমদানি সম্পন্ন: " + result.count; await refresh(); }
    catch (error) { status.textContent = "আমদানি ব্যর্থ: " + String(error.message || error); }
    finally { file.value = ""; }
  });
  panel.querySelector("[data-memory-clear]").addEventListener("click", async () => {
    if (!globalThis.confirm("এই ডিভাইসের সব ব্যক্তিগত স্মৃতি স্থায়ীভাবে মুছে ফেলবেন?")) return;
    await (options.forgetAll ? options.forgetAll() : engine.forgetAll()); await refresh();
  });
  refresh();
}
