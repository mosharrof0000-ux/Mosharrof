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

// Load the composer enhancement from a prepared root-level asset.
import("./composer-enhancements.js")
  .then(function (module) { module.initializeComposerEnhancements(); })
  .catch(function (error) { console.error("Composer enhancement initialization failed:", error); });


// Install the local-first personal memory bridge for chat requests.
import("./core/personal-memory-bridge.js")
  .then(function () { console.info("[MOSHARROF Memory] Local personal memory bridge ready"); })
  .catch(function (error) { console.error("[MOSHARROF Memory] Bridge initialization failed:", error); });

// Load the isolated New Chat / floating-window organ without growing the legacy entrypoint.
import("./new-chat-floating.js").catch(function (error) { console.error("[MOSHARROF Floating Chat] Initialization failed:", error); });
