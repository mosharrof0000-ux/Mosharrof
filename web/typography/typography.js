/* MOSHARROF Bengali Typography Engine
 * Add future fonts to FONT_REGISTRY; content classification remains conservative.
 */
(function(global){
  "use strict";
  var FONT_REGISTRY = {
    "Hind Siliguri": { weights: "400;500;600;700", category: "sans-serif" },
    "Atma": { weights: "400;500;600;700", category: "display" },
    "Mina": { weights: "400;700", category: "serif" },
    "Galada": { weights: "400", category: "display" },
    "Noto Serif Bengali": { weights: "400;500;600;700", category: "serif" },
    "Noto Sans Bengali": { weights: "400;500;600;700", category: "sans-serif" },
    "Tiro Bangla": { weights: "400", category: "serif" },
    "Baloo Da 2": { weights: "400;500;600;700;800", category: "display" },
    "Anek Bangla": { weights: "400;500;600;700", category: "sans-serif" }
  };
  var FONT_BY_TYPE = {
    song: ["Galada", "Atma", "Hind Siliguri"],
    poem: ["Atma", "Mina", "Hind Siliguri"],
    story: ["Hind Siliguri", "Noto Sans Bengali", "Noto Serif Bengali"],
    general: ["Hind Siliguri", "Noto Sans Bengali"]
  };
  var loaded = Object.create(null);

  function googleFontsUrl(fontNames) {
    var families = fontNames.filter(function(name){ return !!FONT_REGISTRY[name]; }).map(function(name){
      var cfg = FONT_REGISTRY[name];
      return "family=" + encodeURIComponent(name).replace(/%20/g, "+") + ":wght@" + cfg.weights.replace(/;/g, ";");
    });
    return families.length ? "https://fonts.googleapis.com/css2?" + families.join("&") + "&display=swap" : "";
  }
  function loadFonts(names) {
    var safe = (names || []).filter(function(name){ return !!FONT_REGISTRY[name] && !loaded[name]; });
    if (!safe.length) return;
    safe.forEach(function(name){ loaded[name] = true; });
    var href = googleFontsUrl(safe);
    if (!href) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.crossOrigin = "anonymous";
    link.dataset.mosharrofFonts = safe.join("|");
    document.head.appendChild(link);
  }
  function registerFont(name, config) {
    if (typeof name !== "string" || !name.trim() || !config || typeof config.weights !== "string") return false;
    FONT_REGISTRY[name.trim()] = { weights: config.weights, category: config.category || "sans-serif" };
    return true;
  }
  function classify(markdown) {
    var text = String(markdown || "").replace(/\r/g, "");
    var lower = text.toLowerCase();
    if (/(^|\n)\s*(গান|গীত|গানের কথা|লিরিক্স|lyrics|song)\s*[:：-]/i.test(text) ||
        /(^|\n)\s*(কোরাস|chorus|refrain)\s*[:：-]/i.test(text) ||
        /(^|\n)\s*(অন্তরা|মুখড়া|মুখড়া)\s*[:：-]/i.test(text)) return "song";
    if (/(কবিতা|কাব্য|পংক্তি|ছন্দোবদ্ধ|ছড়া|ছড়া|poem|poetry)/i.test(text)) return "poem";
    if (/(ছোটগল্প|গল্প|উপন্যাস|গল্পের চরিত্র|story|short story|chapter)/i.test(text) ||
        /(^|\n)\s*(একদিন|অনেক দিন আগে|এক দেশে|গল্পের নাম)\b/.test(text)) return "story";
    /* A title plus several short, line-separated lines is likely verse, not prose. */
    var lines = text.split("\n").map(function(line){ return line.trim(); }).filter(Boolean);
    if (lines.length >= 5) {
      var shortLines = lines.filter(function(line){ return line.length <= 55; }).length;
      if (shortLines / lines.length >= 0.8 && lines.length <= 36) return "poem";
    }
    return "general";
  }
  function decorate(element, markdown) {
    if (!element) return "general";
    var type = classify(markdown);
    element.classList.remove("typography-song","typography-poem","typography-story","typography-general");
    element.classList.add("typography-" + type);
    element.dataset.contentType = type;
    loadFonts(FONT_BY_TYPE[type] || FONT_BY_TYPE.general);
    return type;
  }
  global.MosharrofTypography = {
    version: "1.0.0",
    registerFont: registerFont,
    loadFonts: loadFonts,
    classify: classify,
    decorate: decorate,
    getFonts: function(){ return Object.keys(FONT_REGISTRY); },
    getFontMap: function(){ return JSON.parse(JSON.stringify(FONT_BY_TYPE)); },
    setFontForType: function(type, names) {
      if (!FONT_BY_TYPE[type] || !Array.isArray(names) || !names.length || names.some(function(n){return !FONT_REGISTRY[n];})) return false;
      FONT_BY_TYPE[type] = names.slice();
      return true;
    }
  };
  loadFonts(["Hind Siliguri","Noto Sans Bengali"]);
})(window);
