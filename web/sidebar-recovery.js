/* Sidebar safety net: restore navigation if the primary UI script fails before rendering it. */
(function () {
  "use strict";
  var bootstrapScriptUrl = document.currentScript && document.currentScript.src;
  if (bootstrapScriptUrl && !window.__mosharrofOrganBootstrapRequested) {
    window.__mosharrofOrganBootstrapRequested = true;
    var organLoader = document.createElement("script");
    organLoader.type = "module";
    organLoader.src = new URL("./entities/bootstrap.js", bootstrapScriptUrl).href;
    organLoader.addEventListener("error", function () {
      console.error("[MOSHARROF Organ Runtime] module loader failed");
    }, { once: true });
    document.head.appendChild(organLoader);
  }

  var modules = [
    { title: "System & interface", items: [
      ["core", "মূল সমন্বয়", "⚙"], ["chat", "চ্যাট", "▤"], ["sidebar", "নেভিগেশন", "☷"]
    ]},
    { title: "Interaction & tools", items: [
      ["voice", "ভয়েস", "🎙"], ["tool_factory", "টুল তৈরি", "🧰"]
    ]},
    { title: "Data & research", items: [
      ["storage", "স্টোরেজ", "▣"], ["quran_research", "কুরআন গবেষণা", "📖"]
    ]}
  ];

  function init() {
    var drawer = document.getElementById("drawerLeft");
    var trigger = document.getElementById("leftBtn");
    var scrim = document.getElementById("scrim");
    if (!drawer || !trigger) return;

    var nav = drawer.querySelector("#navL");
    var fallbackNeeded = !nav || !nav.querySelector("button[data-module]");
    if (!fallbackNeeded) return;

    if (!drawer.querySelector(".dhead")) {
      drawer.innerHTML = '<div class="dhead"><div class="dlogo">M</div>' +
        '<div><strong>MOSHARROF</strong><small>Navigation</small></div>' +
        '<button class="dclose" type="button" aria-label="মেনু বন্ধ করুন">✕</button></div>' +
        '<nav class="nav" id="navL" aria-label="প্রধান মেনু"></nav>';
      nav = drawer.querySelector("#navL");
    } else if (!nav) {
      nav = document.createElement("nav");
      nav.className = "nav";
      nav.id = "navL";
      nav.setAttribute("aria-label", "প্রধান মেনু");
      drawer.appendChild(nav);
    }

    modules.forEach(function (family) {
      var section = document.createElement("section");
      section.className = "nav-family";
      var heading = document.createElement("div");
      heading.className = "nav-family-title";
      heading.textContent = family.title;
      section.appendChild(heading);
      var items = document.createElement("div");
      items.className = "nav-family-items";
      family.items.forEach(function (entry) {
        var button = document.createElement("button");
        button.type = "button";
        button.setAttribute("data-module", entry[0]);
        button.setAttribute("aria-label", entry[1]);
        button.innerHTML = '<span class="nav-icon" aria-hidden="true">' + entry[2] +
          '</span><span class="nav-copy"><span>' + entry[1] +
          '</span><small>' + entry[0] + '</small></span>';
        button.addEventListener("click", function () {
          Array.prototype.forEach.call(nav.querySelectorAll("button[data-module]"), function (other) {
            other.classList.remove("active");
            other.removeAttribute("aria-current");
          });
          button.classList.add("active");
          button.setAttribute("aria-current", "page");
          var toast = document.getElementById("toast");
          if (toast) {
            toast.textContent = entry[1] + " · " + entry[0];
            toast.classList.add("show");
            window.setTimeout(function () { toast.classList.remove("show"); }, 2200);
          }
        });
        items.appendChild(button);
      });
      section.appendChild(items);
      nav.appendChild(section);
    });

    function closeDrawer() {
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
      if (scrim) scrim.classList.remove("open");
    }
    if (!trigger.__mosharrofSidebarFallback) {
      trigger.__mosharrofSidebarFallback = true;
      trigger.addEventListener("click", function () {
        drawer.classList.add("open");
        drawer.setAttribute("aria-hidden", "false");
        if (scrim) scrim.classList.add("open");
      });
    }
    var close = drawer.querySelector(".dclose");
    if (close && !close.__mosharrofSidebarFallback) {
      close.__mosharrofSidebarFallback = true;
      close.addEventListener("click", closeDrawer);
    }
    if (scrim && !scrim.__mosharrofSidebarFallback) {
      scrim.__mosharrofSidebarFallback = true;
      scrim.addEventListener("click", closeDrawer);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

// Initialize the composer enhancement directly in the live-page script.
(function initializeLiveComposerEnhancement() {
  function init() {
    if (document.getElementById("composerExpandBtn")) return;
    var input = document.getElementById("input");
    var composer = document.getElementById("composer");
    var send = document.getElementById("sendBtn");
    if (!input || !composer || !send || !send.parentNode) return;

    var style = document.createElement("style");
    style.id = "chat-composer-expand-styles";
    style.textContent = [
      "#composer .row{gap:6px;align-items:flex-end}",
      "#composer .input{min-height:34px!important;padding-top:6px!important;padding-bottom:6px!important}",
      "#composerExpandBtn{display:none}",
      "#composerExpandBtn.visible{display:inline-grid}",
      ".mosharrof-expand-editor{position:fixed;inset:0;z-index:20000;display:none;flex-direction:column;background:#050505;padding:calc(14px + env(safe-area-inset-top,0px)) 14px calc(14px + env(safe-area-inset-bottom,0px));color:#f5f5f5}",
      ".mosharrof-expand-editor.open{display:flex}",
      ".mosharrof-expand-head{display:flex;align-items:center;gap:8px;padding:4px 0 14px;border-bottom:1px solid rgba(255,255,255,.14)}",
      ".mosharrof-expand-title{flex:1;font-size:15px;font-weight:700}",
      ".mosharrof-expand-btn{min-height:38px;padding:0 12px;border:1px solid rgba(255,255,255,.18);border-radius:10px;background:#171717;color:#f5f5f5;font-size:13px}",
      ".mosharrof-expand-apply{background:#f1f1f1;color:#111;border-color:#f1f1f1;font-weight:700}",
      ".mosharrof-expand-text{flex:1;width:100%;min-height:0;margin:14px 0;padding:14px;border:1px solid rgba(255,255,255,.15);border-radius:14px;outline:none;resize:none;background:#111;color:#f5f5f5;font-size:16px;line-height:1.7;font-family:inherit;overflow:auto}",
      ".mosharrof-expand-text:focus{border-color:rgba(255,255,255,.38)}",
      ".mosharrof-expand-hint{font-size:11px;color:#92929a;padding:0 2px 8px}",
      "@media(max-width:480px){#composer .input{padding-left:4px!important;padding-right:4px!important}#composer .composer-action,#composer .send{width:34px;height:34px}#composerExpandBtn svg{width:16px;height:16px}}"
    ].join("\n");
    document.head.appendChild(style);

    var expand = document.createElement("button");
    expand.className = "composer-action";
    expand.id = "composerExpandBtn";
    expand.type = "button";
    expand.setAttribute("aria-label", "বড় পর্দায় লেখা সম্পাদনা করুন");
    expand.title = "বড় পর্দায় লেখা খুলুন";
    expand.setAttribute("aria-controls", "mosharrofExpandEditor");
    expand.setAttribute("aria-expanded", "false");
    expand.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    send.parentNode.insertBefore(expand, send);

    var editor = document.createElement("section");
    editor.className = "mosharrof-expand-editor";
    editor.id = "mosharrofExpandEditor";
    editor.setAttribute("role", "dialog");
    editor.setAttribute("aria-modal", "true");
    editor.setAttribute("aria-hidden", "true");
    editor.setAttribute("aria-labelledby", "mosharrofExpandTitle");
    editor.innerHTML = '<div class="mosharrof-expand-head"><div class="mosharrof-expand-title" id="mosharrofExpandTitle">বার্তা সম্পাদনা</div><button class="mosharrof-expand-btn" type="button" data-expand-cancel>ফিরে যান</button><button class="mosharrof-expand-btn mosharrof-expand-apply" type="button" data-expand-apply>লেখা ব্যবহার করুন</button></div><textarea class="mosharrof-expand-text" aria-label="সম্পূর্ণ বার্তা সম্পাদনা করুন" placeholder="এখানে আপনার সম্পূর্ণ বার্তা লিখুন..."></textarea><div class="mosharrof-expand-hint">সম্পাদিত লেখা মূল মেসেজ বক্সে নিতে “লেখা ব্যবহার করুন” চাপুন।</div>';
    document.body.appendChild(editor);
    var largeInput = editor.querySelector("textarea");

    function syncVisibility() {
      expand.classList.toggle("visible", !!String(input.value || "").trim());
    }
    function openEditor() {
      if (!String(input.value || "").trim()) return;
      largeInput.value = input.value;
      editor.classList.add("open");
      editor.setAttribute("aria-hidden", "false");
      expand.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      largeInput.focus();
      largeInput.setSelectionRange(largeInput.value.length, largeInput.value.length);
    }
    function closeEditor(apply) {
      if (apply) {
        input.value = largeInput.value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        syncVisibility();
      }
      editor.classList.remove("open");
      editor.setAttribute("aria-hidden", "true");
      expand.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      if (apply) input.focus();
    }

    input.addEventListener("input", syncVisibility);
    expand.addEventListener("click", openEditor);
    editor.querySelector("[data-expand-cancel]").addEventListener("click", function(){ closeEditor(false); });
    editor.querySelector("[data-expand-apply]").addEventListener("click", function(){ closeEditor(true); });
    editor.addEventListener("click", function(event){ if (event.target === editor) closeEditor(false); });
    document.addEventListener("keydown", function(event){ if (event.key === "Escape" && editor.classList.contains("open")) closeEditor(false); });
    syncVisibility();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
