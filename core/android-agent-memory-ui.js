/* User-consented, on-device memory controls. Uses local lexical-hash vectors; no cloud embeddings. */
(function () {
  "use strict";
  const CONSENT_KEY = "mosharrof-agent-memory-consent-v1";

  function embed(text) {
    const vector = new Array(256).fill(0);
    const words = String(text || "").toLocaleLowerCase("bn").split(/[\s,।.!?;:()[\]{}]+/).filter(Boolean);
    for (const word of words) {
      let hash = 2166136261;
      for (let i = 0; i < word.length; i += 1) hash = Math.imul(hash ^ word.charCodeAt(i), 16777619);
      vector[(hash >>> 0) % vector.length] += (hash & 1) ? 1 : -1;
    }
    return vector;
  }

  function init() {
    const nav = document.getElementById("navR");
    const library = window.MosharrofAgentMemory;
    if (!nav || !library || document.getElementById("mosAgentMemory")) return;
    const section = document.createElement("section");
    section.className = "nav-family";
    section.id = "mosAgentMemory";
    section.innerHTML =
      '<div class="nav-family-title"><span aria-hidden="true">▤</span><span>লোকাল এজেন্ট মেমোরি</span></div>' +
      '<p>শুধু আপনার অনুমতিতে এই ডিভাইসে পছন্দ ও কাজের নোট থাকবে। পাসওয়ার্ড, PIN, OTP বা পেমেন্ট তথ্য সংরক্ষণ করা যাবে না।</p>' +
      '<label><input type="checkbox" data-memory="consent"> লোকাল মেমোরি চালু করুন</label>' +
      '<textarea data-memory="entry" rows="2" placeholder="যে পছন্দ বা নোটটি মনে রাখতে চান"></textarea>' +
      '<div class="device-quick-actions"><button type="button" data-memory="save">মনে রাখুন</button>' +
      '<input data-memory="query" placeholder="লোকাল মেমোরিতে খুঁজুন">' +
      '<button type="button" data-memory="search">খুঁজুন</button>' +
      '<button type="button" data-memory="refresh">সংরক্ষিত নোট দেখুন</button>' +
      '<button type="button" data-memory="clear">সব নোট মুছুন</button></div>' +
      '<div data-memory="status" role="status" aria-live="polite">লোকাল মেমোরি বন্ধ আছে।</div>' +
      '<div data-memory="results"></div>';
    nav.appendChild(section);
    const consent = section.querySelector('[data-memory="consent"]');
    const entry = section.querySelector('[data-memory="entry"]');
    const query = section.querySelector('[data-memory="query"]');
    const status = section.querySelector('[data-memory="status"]');
    const results = section.querySelector('[data-memory="results"]');
    function isEnabled() {
      try { return window.localStorage.getItem(CONSENT_KEY) === "enabled"; }
      catch (_) { return false; }
    }
    let memory = library.createMemory({ enabled: isEnabled() });
    consent.checked = isEnabled();

    function showRows(rows, scores) {
      results.textContent = "";
      if (!rows.length) { results.textContent = "কোনো নোট পাওয়া যায়নি।"; return; }
      rows.forEach(function (record) {
        const row = document.createElement("div");
        row.className = "device-quick-actions";
        const text = document.createElement("div");
        text.textContent = record.text + (scores ? " · মিল " + Math.round(record.score * 100) + "%" : "");
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "মুছুন";
        remove.addEventListener("click", async function () {
          if (!window.confirm("এই লোকাল মেমোরি নোটটি মুছবেন?")) return;
          try { await memory.forget(record.id); status.textContent = "নোট মুছে ফেলা হয়েছে।"; await refresh(); }
          catch (error) { status.textContent = error.message || String(error); }
        });
        row.appendChild(text);
        row.appendChild(remove);
        results.appendChild(row);
      });
    }
    async function refresh() {
      if (!memory.enabled) { status.textContent = "লোকাল মেমোরি বন্ধ আছে; কিছু পড়া বা লেখা হয়নি।"; results.textContent = ""; return; }
      try { const rows = await memory.list(); showRows(rows, false); status.textContent = rows.length + "টি নোট এই ডিভাইসে সংরক্ষিত।"; }
      catch (error) { status.textContent = error.message || String(error); }
    }
    consent.addEventListener("change", function () {
      if (consent.checked && !window.confirm("নোট ও embedding শুধু এই ডিভাইসের IndexedDB-তে রাখা হবে। কোনো ক্লাউডে পাঠানো হবে না। চালু করবেন?")) {
        consent.checked = false;
        return;
      }
      try { window.localStorage.setItem(CONSENT_KEY, consent.checked ? "enabled" : "disabled"); }
      catch (_) { consent.checked = false; status.textContent = "অনুমতির অবস্থা সংরক্ষণ করা যায়নি।"; return; }
      memory = library.createMemory({ enabled: consent.checked });
      status.textContent = consent.checked ? "লোকাল মেমোরি চালু হয়েছে।" : "লোকাল মেমোরি বন্ধ হয়েছে; আগের নোট মুছে যায়নি।";
      refresh();
    });
    section.addEventListener("click", async function (event) {
      const button = event.target.closest("button[data-memory]");
      if (!button) return;
      const action = button.getAttribute("data-memory");
      try {
        if (action === "save") {
          await memory.remember({ text: entry.value, embedding: embed(entry.value), tags: ["user-note"] });
          entry.value = "";
          status.textContent = "নোট লোকাল মেমোরিতে সংরক্ষিত হয়েছে।";
          await refresh();
        } else if (action === "search") {
          const term = query.value.trim();
          if (!term) { status.textContent = "খোঁজার শব্দ লিখুন।"; return; }
          const found = await memory.search(embed(term), 5);
          showRows(found, true);
          status.textContent = found.length + "টি মিল পাওয়া গেছে; অনুসন্ধান লোকালেই হয়েছে।";
        } else if (action === "refresh") {
          await refresh();
        } else if (action === "clear") {
          if (!window.confirm("এই ডিভাইসের সব লোকাল এজেন্ট মেমোরি স্থায়ীভাবে মুছবেন?")) return;
          const result = await memory.clear();
          results.textContent = "";
          status.textContent = result.deleted + "টি নোট মুছে ফেলা হয়েছে।";
        }
      } catch (error) { status.textContent = error.message || String(error); }
    });
    if (memory.enabled) refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
