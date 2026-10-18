/* MOSHARROF Smart Visual Intelligence Engine (SVIE)
 * Semantic, opt-in visual rules. Never paints the whole interface.
 */
(function (root) {
  "use strict";
  const PALETTE = Object.freeze({ red: "#DC2626", blue: "#2563EB", green: "#16A34A", yellow: "#EAB308" });
  const STATES = Object.freeze({
    error: "red", failed: "red", unavailable: "red", "stop-requested": "red",
    success: "green", verified: "green", passed: "green", connected: "green", complete: "green", ready: "green", active: "green",
    pending: "yellow", checking: "yellow", loading: "yellow", waiting: "yellow",
    selected: "blue", manual: "blue", "active-control": "blue"
  });
  const NEUTRAL = Object.freeze({ tone: "neutral", badge: false, tint: false, emphasis: "low", reason: "no-semantic-signal" });

  function resolve(input) {
    const options = input || {};
    const component = String(options.component || "generic").toLowerCase();
    const state = String(options.state || "neutral").toLowerCase();
    const severity = String(options.severity || "normal").toLowerCase();
    const theme = options.theme === "light" ? "light" : "dark";
    let tone = STATES[state] || "neutral";
    if (state === "recording") tone = component === "recording-indicator" ? "red" : "neutral";
    if (state === "pending" && component === "timer") tone = "yellow";
    if (state === "selected" && !["control", "button", "menu-item", "model-option"].includes(component)) tone = "neutral";
    if (tone === "neutral") return Object.assign({}, NEUTRAL, { theme: theme });
    const isStatus = ["status", "badge", "pill", "timer", "recording-indicator"].includes(component);
    const highSeverity = severity === "high" || severity === "critical";
    const wantsTint = options.tint === true && ["control", "button", "surface", "status", "badge", "pill"].includes(component);
    return {
      tone: tone,
      badge: isStatus && options.badge !== false && ["red", "green", "yellow"].includes(tone),
      tint: wantsTint || (highSeverity && tone === "red" && ["surface", "status", "badge"].includes(component)),
      emphasis: highSeverity ? "high" : (tone === "blue" ? "medium" : "low"),
      theme: theme,
      reason: "semantic-state"
    };
  }

  function apply(element, input) {
    if (!element || typeof element.setAttribute !== "function") return false;
    if (!element.hasAttribute || !element.hasAttribute("data-visual-intelligence")) return false;
    const options = Object.assign({}, input || {});
    options.component = options.component || element.getAttribute("data-visual-intelligence");
    options.state = options.state || element.getAttribute("data-state") || element.getAttribute("data-status");
    const style = resolve(options);
    element.setAttribute("data-svie-tone", style.tone);
    element.setAttribute("data-svie-badge", style.badge ? "true" : "false");
    element.setAttribute("data-svie-tint", style.tint ? "true" : "false");
    element.setAttribute("data-svie-emphasis", style.emphasis);
    return style;
  }

  function inferKnownState(element) {
    if (element.classList.contains("is-error") || element.classList.contains("is-late") || element.classList.contains("is-stop-requested")) return "error";
    if (element.classList.contains("is-download") || element.classList.contains("is-ready") || element.classList.contains("is-speaking")) return "success";
    if (element.disabled || element.closest(".message.typing")) return "pending";
    if (element.matches(".response-timer") && element.closest(".message.ai")) return "success";
    return "neutral";
  }

  function enhanceKnownStatusControls(rootNode) {
    const doc = rootNode || (root.document || null);
    if (!doc || !doc.querySelectorAll) return { enhanced: 0 };
    let enhanced = 0;
    doc.querySelectorAll(".response-timer,.voice-companion,.message-speak-shortcut,.message-action").forEach(function (element) {
      if (!element.hasAttribute("data-visual-intelligence")) {
        const component = element.matches(".response-timer") ? "timer" : (element.matches(".voice-companion") ? "status" : "control");
        element.setAttribute("data-visual-intelligence", component);
      }
      const state = inferKnownState(element);
      const component = element.getAttribute("data-visual-intelligence");
      apply(element, { component: component, state: state, severity: state === "error" ? "high" : "normal", tint: state === "error" && component === "status" });
      enhanced += 1;
    });
    return { enhanced: enhanced };
  }

  function audit(rootNode) {
    const doc = rootNode || (root.document || null);
    const elements = doc && doc.querySelectorAll ? Array.from(doc.querySelectorAll("[data-visual-intelligence]")) : [];
    const issues = [];
    elements.forEach(function (element) {
      const tone = element.getAttribute("data-svie-tone") || "neutral";
      if (tone !== "neutral" && !Object.prototype.hasOwnProperty.call(PALETTE, tone)) {
        issues.push({ code: "unsupported-tone", component: element.getAttribute("data-visual-intelligence"), tone: tone });
      }
      if (tone !== "neutral" && !element.getAttribute("data-state") && !element.getAttribute("data-status") && inferKnownState(element) === "neutral") {
        issues.push({ code: "color-without-semantic-state", component: element.getAttribute("data-visual-intelligence"), tone: tone });
      }
    });
    return { scanned: elements.length, issues: issues, passed: issues.length === 0 };
  }

  const api = Object.freeze({
    name: "MOSHARROF Smart Visual Intelligence Engine", version: "1.0.0", palette: PALETTE,
    resolve: resolve, apply: apply, enhanceKnownStatusControls: enhanceKnownStatusControls, audit: audit
  });
  root.MosharrofVisualIntelligence = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root.document) {
    const boot = function () {
      enhanceKnownStatusControls(root.document);
      const observer = new root.MutationObserver(function (records) {
        const refresh = records.some(function (record) {
          return record.type === "childList" || record.attributeName === "class" || record.attributeName === "disabled";
        });
        if (refresh) enhanceKnownStatusControls(root.document);
      });
      observer.observe(root.document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "disabled"] });
    };
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", boot, { once: true });
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
