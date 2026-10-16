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
          const saved = await engine.add({
            kind: "user", text: requestBody.text, sessionId: "mosharrof-chat",
            sequence: ++sequence, previousId
          }).catch(() => ({ stored: false }));
          if (saved.stored) previousId = saved.id;
          const memoryContext = await engine.buildContext(requestBody.text).catch(() => "");
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
