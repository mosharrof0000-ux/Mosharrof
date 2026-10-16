/* Adds relevant memories and recent session context to chat requests. */
(function(root) {
  "use strict";
  const api = root.MosharrofMemoryEngine;
  if (!api || !root.fetch) return;
  function isChatRequest(input) {
    try {
      const url = new URL(typeof input === "string" ? input : input.url, root.location.href);
      return url.pathname.replace(/\/$/, "").endsWith("/chat");
    } catch (_) { return false; }
  }
  function activeSessionMessages() {
    try {
      const sessions = JSON.parse(root.localStorage.getItem(SESSION_KEY) || "[]");
      const activeId = root.localStorage.getItem(ACTIVE_SESSION_KEY);
      const session = sessions.find(item => item && item.id === activeId) || sessions[0];
      return session && Array.isArray(session.messages) ? session.messages : [];
    } catch (_) { return []; }
  }
  function recentHistory(currentText) {
    const messages = activeSessionMessages().filter(item => item && (item.role === "user" || item.role === "ai") && String(item.text || "").trim());
    if (messages.length && messages[messages.length - 1].role === "user" && String(messages[messages.length - 1].text || "").trim() === currentText) messages.pop();
    return messages.slice(-12).map(item => ({ role: item.role, text: String(item.text || "").slice(0, 900) }));
  }
  function currentSummary(currentText) {
    const messages = activeSessionMessages().filter(item => item && (item.role === "user" || item.role === "ai") && String(item.text || "").trim());
    if (messages.length && messages[messages.length - 1].role === "user" && String(messages[messages.length - 1].text || "").trim() === currentText) messages.pop();
    return messages.slice(-8).map(item => (item.role === "user" ? "User: " : "MOSHARROF: ") + String(item.text || "").replace(/\\s+/g, " ").slice(0, 350)).join("\\n").slice(-1200);
  }
  function answerFromResponse(raw, contentType) {
    try {
      if (String(contentType || "").includes("text/event-stream")) {
        const lines = raw.split(/\\r?\\n/).filter(line => line.startsWith("data:"));
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const event = JSON.parse(lines[i].slice(5).trim());
            if (event.type === "result" && event.data && event.data.text) return String(event.data.text);
          } catch (_) {}
        }
        return "";
      }
      const data = JSON.parse(raw);
      return String(data.text || data.data && data.data.text || "");
    } catch (_) { return ""; }
  }
  function installFetchBridge() {
    if (!root.fetch || root.__mosharrofMemoryFetchInstalled) return;
    root.__mosharrofMemoryFetchInstalled = true;
    const originalFetch = root.fetch.bind(root);
    root.fetch = async function (input, init) {
      if (!isChatRequest(input) || !init || typeof init.body !== "string") return originalFetch(input, init);
      let payload;
      try { payload = JSON.parse(init.body); } catch (_) { return originalFetch(input, init); }
      const userText = String(payload.text || "").trim();
      if (!userText) return originalFetch(input, init);
      try {
        if (api.enabled()) {
          await api.remember(userText, "current-chat-user-message");
          payload.history = recentHistory(userText);
          payload.conversation_summary = currentSummary(userText);
          payload.memory_context = await api.contextFor(userText);
          payload.memory_policy = "Historical context only: current request and corrections override older memories. Treat inferred preferences as tentative; do not force unrelated memories into the answer.";
        }
      } catch (error) {
        // Memory is an enhancement; a storage failure must never block chat.
        try { console.warn("MOSHARROF memory unavailable:", error); } catch (_) {}
      }
      const nextInit = Object.assign({}, init, { body: JSON.stringify(payload) });
      const response = await originalFetch(input, nextInit);
      if (api.enabled() && response && response.clone) {
        try {
          response.clone().text().then(async function(raw) {
            const answer = answerFromResponse(raw, response.headers.get("content-type"));
            if (answer.trim()) await api.remember("User asked: " + userText + "\\nMOSHARROF AI answered: " + answer, "assistant-response");
          }).catch(function(error) { try { console.warn("MOSHARROF memory response capture failed:", error); } catch (_) {} });
        } catch (_) {}
      }
      return response;
    };
  }
  const api = Object.freeze({ enabled, setEnabled, remember, retrieve, contextFor, list, remove, clear, mountUi });
  root.MosharrofMemoryEngine = api;
  if (root.document) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { mountUi(); installFetchBridge(); }, { once: true });
    else { mountUi(); installFetchBridge(); }
  }
  if (root.document) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installFetchBridge, { once: true });
    else installFetchBridge();
  }
})(typeof window !== "undefined" ? window : globalThis);
