import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadWorker } from "./worker-loader.mjs";

const source = await readFile(new URL("../core/personal-memory-engine.js", import.meta.url), "utf8");
const { createPersonalMemoryEngine, buildPersonalMemoryContext, inferMemoryCandidates } =
  await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const worker = await loadWorker();
const originalFetch = globalThis.fetch;
const memoryStorage = new Map();
const storage = {
  getItem: key => memoryStorage.has(key) ? memoryStorage.get(key) : null,
  setItem: (key, value) => memoryStorage.set(key, value),
  removeItem: key => memoryStorage.delete(key)
};
const memory = createPersonalMemoryEngine({ storage, now: () => "2026-10-17T00:00:00.000Z" });
function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
try {
  await memory.remember({ id: "pref-1", category: "preference", content: "গল্পে বিস্তারিত ঘটনা ও পূর্ণাঙ্গ সমাপ্তি পছন্দ", user_confirmed: true });
  await memory.remember({ id: "goal-1", category: "goal", content: "MOSHARROF AI-তে স্মৃতি ও ধাপে ধাপে চিন্তার প্রেক্ষাপট ব্যবহার করা" });
  assert.equal((await memory.recall()).total, 2);
  assert.equal((await memory.recall({ category: "preference" })).items.length, 1);
  const prior = (await memory.recall({ category: "goal" })).items[0];
  await memory.revise(prior.id, { content: "বর্তমান লক্ষ্য: স্মৃতি কালানুক্রমে রাখা ও পরবর্তী ধাপ অনুমান করা", category: "goal", user_confirmed: true });
  const timeline = await memory.timeline();
  assert.equal(timeline.items.length, 3);
  assert.equal(timeline.items[0].status, "superseded");
  assert.ok(timeline.items[1].supersedes);
  for (let i = 0; i < 250; i++) await memory.remember({ id: "scale-" + i, category: "fact", content: "Memory growth record " + i });
  assert.equal((await memory.recall()).total, 253);
  await assert.rejects(() => memory.remember({ content: "API_KEY=do-not-save" }), /Secret-like content/);
  assert.match(buildPersonalMemoryContext(await memory.exportAll(), "একটি গল্প লিখো"), /পূর্ণাঙ্গ সমাপ্তি/);
  assert.match(buildPersonalMemoryContext(await memory.exportAll(), "একটি গল্প লিখো"), /what happened before/i);
  assert.equal(inferMemoryCandidates("ভবিষ্যতে আমার পছন্দ মনে রাখবে").length, 1);
  assert.equal(inferMemoryCandidates("হ্যালো").length, 0);

  let geminiRequestBody;
  globalThis.fetch = async (url, options) => {
    if (!String(url).includes("generativelanguage.googleapis.com")) return response({});
    geminiRequestBody = JSON.parse(options.body);
    return response({ candidates: [{ content: { parts: [{ text: "Memory-aware answer" }] } }] });
  };
  const request = new Request("https://worker.test/chat", {
    method: "POST",
    headers: { Origin: "https://mosharrof0000-ux.github.io", "Content-Type": "application/json" },
    body: JSON.stringify({ text: "ভবিষ্যতে আমার পছন্দ মনে রাখবে", stream_status: false, personal_memory: await memory.exportAll(), memory_suggestions_enabled: true })
  });
  const responseValue = await worker.fetch(request, { GEMINI_API_KEY: "test-key" });
  const result = await responseValue.json();
  assert.equal(responseValue.status, 200);
  assert.match(geminiRequestBody.contents[0].parts[0].text, /USER PERSONAL MEMORY/);
  assert.match(geminiRequestBody.contents[0].parts[0].text, /পূর্ণাঙ্গ সমাপ্তি/);
  assert.equal(result.memory_candidates.length, 1);
  console.log("Personal memory worker integration: PASS");
} finally {
  globalThis.fetch = originalFetch;
}
