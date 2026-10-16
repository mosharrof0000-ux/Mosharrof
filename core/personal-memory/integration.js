import { createIndexedDbMemoryStore } from "./indexeddb-store.js";
import { createPersonalMemoryEngine } from "./engine.js";
import { installMemoryControls } from "./controls.js";
import { formatRetrievedMemory } from "./context.js";
import { inferResponseStyle } from "./length-intent.js";

const ENABLED_KEY = "mosharrof:personal-memory:enabled:v1";
const CHAT_URL_PART = "/chat";
const SESSION_ID = "chat-" + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
let initialized = false;

function enabledByDefault() {
  try { return localStorage.getItem(ENABLED_KEY) !== "false"; } catch { return true; }
}
function setEnabled(value) {
  try { localStorage.setItem(ENABLED_KEY, value ? "true" : "false"); } catch {}
}
function isChatRequest(input) {
  try { return new URL(typeof input === "string" ? input : input.url, location.href).pathname.endsWith(CHAT_URL_PART); }
  catch { return false; }
}
function parseSseResult(raw) {
  let result = null;
  for (const line of String(raw || "").split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    try {
      const event = JSON.parse(line.slice(5).trim());
      if (event.type === "result" && event.status === 200 && event.data?.ok && typeof event.data.text === "string") result = event.data.text;
    } catch {}
  }
  return result;
}
export function initializePersonalMemory() {
  if (initialized || typeof window === "undefined" || typeof indexedDB === "undefined") return;
  initialized = true;
  const store = createIndexedDbMemoryStore();
  const engine = createPersonalMemoryEngine({ store });
  const originalFetch = window.fetch.bind(window);
  const turns = [];
  let ready = false;
  const memoryReady = store.count().then(() => { ready = true; }).catch(error => {
    console.warn("[MOSHARROF memory] storage unavailable", error);
  });
  window.MosharrofPersonalMemory = Object.freeze({
    engine, ready: memoryReady,
    inspect: () => engine.stats(), search: (query, options) => engine.retrieve(query, options),
    exportAll: () => engine.exportAll(), forgetAll: () => engine.forgetAll()
  });
  installMemoryControls(engine, { isEnabled: enabledByDefault, setEnabled });
  window.fetch = async function personalMemoryFetch(input, init = {}) {
    if (!isChatRequest(input) || !init.body || !enabledByDefault()) return originalFetch(input, init);
    let body;
    try { body = JSON.parse(typeof init.body === "string" ? init.body : ""); } catch { return originalFetch(input, init); }
    if (!String(body.text || "").trim()) return originalFetch(input, init);
    await memoryReady;
    const userText = String(body.text).trim();
    let retrieved = { text: "" }, intent = { mode: "normal", source: "default", confidence: 0.55 };
    try {
      retrieved = await engine.contextFor(userText, { conversationId: SESSION_ID, limit: 8, maxChars: 5000 });
      intent = inferResponseStyle(userText, retrieved.memories);
      body.memory_context = formatRetrievedMemory(retrieved.text);
      body.memory_response_style = intent;
      await engine.remember({ text: userText, role: "user", kind: "message", conversationId: SESSION_ID, source: "live-chat" });
      turns.push({ role: "user", text: userText });
      await engine.saveConversationSummary(SESSION_ID, turns);
    } catch (error) { console.warn("[MOSHARROF memory] retrieval failed; continuing without memory", error); }
    const requestInit = { ...init, body: JSON.stringify(body) };
    let response;
    try { response = await originalFetch(input, requestInit); }
    catch (error) { throw error; }
    try {
      response.clone().text().then(async raw => {
        const answer = parseSseResult(raw);
        if (!answer) return;
        turns.push({ role: "assistant", text: answer });
        await engine.remember({ text: answer, role: "assistant", kind: "message", conversationId: SESSION_ID, source: "live-chat" });
        await engine.saveConversationSummary(SESSION_ID, turns);
      }).catch(error => console.warn("[MOSHARROF memory] reply capture failed", error));
    } catch (error) { console.warn("[MOSHARROF memory] response clone failed", error); }
    return response;
  };
}
