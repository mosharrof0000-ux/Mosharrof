import assert from "node:assert/strict";
import { loadWorker } from "./worker-loader.mjs";

const worker = await loadWorker();
const originalFetch = globalThis.fetch;

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
function geminiQuota() {
  return response({ error: { message: "quota exceeded" } }, 429);
}
async function ask(env, text = "বাংলায় একটি সংক্ষিপ্ত উত্তর দিন") {
  const request = new Request("https://worker.test/chat", {
    method: "POST",
    headers: { "Origin": "https://mosharrof0000-ux.github.io", "Content-Type": "application/json" },
    body: JSON.stringify({ text, stream_status: false })
  });
  const res = await worker.fetch(request, env);
  return { status: res.status, data: await res.json() };
}
async function askStream(env) {
  const request = new Request("https://worker.test/chat", {
    method: "POST",
    headers: { "Origin": "https://mosharrof0000-ux.github.io", "Content-Type": "application/json" },
    body: JSON.stringify({ text: "বাংলায় একটি সংক্ষিপ্ত উত্তর দিন", stream_status: true })
  });
  const res = await worker.fetch(request, env);
  return { status: res.status, text: await res.text() };
}
try {
  let geminiRequestBody = null;
  globalThis.fetch = async (url, options) => {
    if (!String(url).includes("generativelanguage.googleapis.com")) return response({});
    geminiRequestBody = JSON.parse(options.body);
    return response({ candidates: [{ content: { parts: [{ text: "Gemini answer" }] } }] });
  };
  let result = await ask({ GEMINI_API_KEY: "test-key" });
  assert.equal(result.status, 200);
  assert.equal(result.data.provider, "gemini");
  assert.match(result.data.text, /Gemini answer/);
  const geminiPrompt = geminiRequestBody.contents[0].parts[0].text;
  assert.match(geminiPrompt, /Before answering/);
  assert.match(geminiPrompt, /Before sending/);
  assert.match(geminiPrompt, /Do not reveal private chain-of-thought/);
  assert.equal(geminiRequestBody.generationConfig, undefined, "normal replies keep the default output budget");

  globalThis.fetch = async (url, options) => {
    if (!String(url).includes("generativelanguage.googleapis.com")) return response({});
    geminiRequestBody = JSON.parse(options.body);
    return response({ candidates: [{ content: { parts: [{ text: "Long story opening" }] } }] });
  };
  result = await ask({ GEMINI_API_KEY: "test-key" }, "বাংলায় ৫০০০ শব্দের একটি গল্প লিখে দাও");
  assert.equal(result.status, 200);
  assert.equal(result.data.requested_words, 5000);
  assert.ok(geminiRequestBody.generationConfig.maxOutputTokens >= 15000);
  assert.match(geminiRequestBody.contents[0].parts[0].text, /approximately 5000 words/);

  result = await ask({ GEMINI_API_KEY: "test-key" }, "Write a story of 20 thousand words");
  assert.equal(result.status, 200);
  assert.equal(result.data.requested_words, 20000);
  assert.equal(geminiRequestBody.generationConfig.maxOutputTokens, 62512);

  const seenKeys = [];
  globalThis.fetch = async (url, options) => {
    if (!String(url).includes("generativelanguage.googleapis.com")) return response({});
    const key = options.headers["x-goog-api-key"];
    seenKeys.push(key);
    return key === "project2"
      ? response({ candidates: [{ content: { parts: [{ text: "Second Gemini key answer" }] } }] })
      : geminiQuota();
  };
  result = await ask({
    GEMINI_API_KEY: "primary",
    GEMINI_API_KEY_2: "project2",
    GEMINI_API_KEY_3: "project3",
    GEMINI_API_KEY_4: "project4",
    GEMINI_API_KEY_5: "project5"
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.provider, "gemini");
  assert.match(result.data.text, /Second Gemini key answer/);
  assert.deepEqual(seenKeys.slice(0, 2), ["primary", "project2"]);

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (!u.includes("generativelanguage.googleapis.com")) return response({});
    if (u.includes("gemini-3.8-flash")) return response({ error: { message: "model not found" } }, 404);
    if (u.includes("gemini-3.7-flash")) return response({ candidates: [{ content: { parts: [{ text: "Fallback Gemini model answer" }] } }] });
    return geminiQuota();
  };
  result = await ask({ GEMINI_API_KEY: "test-key" });
  assert.equal(result.status, 200);
  assert.equal(result.data.provider, "gemini");
  assert.equal(result.data.model, "gemini-3.7-flash");
  assert.match(result.data.text, /Fallback Gemini model answer/);

  globalThis.fetch = async (url) => String(url).includes("generativelanguage.googleapis.com") ? geminiQuota() : response({});
  let workerAiMessages = [];
  result = await ask({
    GEMINI_API_KEY: "test-key",
    AI: { run: async (_model, input) => { workerAiMessages = input.messages; return { response: "Workers AI answer" }; } }
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.provider, "cloudflare-workers-ai");
  assert.match(result.data.text, /Workers AI answer/);
  assert.match(workerAiMessages[0].content, /Before answering/);
  assert.match(workerAiMessages[0].content, /possible emotional needs/);
  assert.ok(result.data.attempted.some(x => x.provider === "gemini" && x.status === 429));

  globalThis.fetch = async (url) => {
    if (String(url).includes("generativelanguage.googleapis.com")) return geminiQuota();
    if (String(url).includes("api.groq.com")) return response({ choices: [{ message: { content: "Groq answer" } }] });
    return response({});
  };
  result = await ask({
    GEMINI_API_KEY: "test-key",
    GROQ_API_KEY: "test-groq-key",
    AI: { run: async () => { throw new Error("simulated Workers AI outage"); } }
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.provider, "groq");
  assert.match(result.data.text, /Groq answer/);

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("generativelanguage.googleapis.com")) return geminiQuota();
    if (u.includes("api.groq.com")) return response({ error: { message: "rate limited" } }, 429);
    if (u.includes("openrouter.ai")) return response({ choices: [{ message: { content: "OpenRouter answer" } }] });
    return response({});
  };
  result = await ask({
    GEMINI_API_KEY: "test-key",
    GROQ_API_KEY: "test-groq-key",
    OPENROUTER_API_KEY: "test-openrouter-key",
    AI: { run: async () => { throw new Error("simulated Workers AI outage"); } }
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.provider, "openrouter");
  assert.match(result.data.text, /OpenRouter answer/);

  // Intelligence regression: HTTP 503 from Gemini must not be reported as a successful Gemini answer.
  globalThis.fetch = async (url) => String(url).includes("generativelanguage.googleapis.com")
    ? response({ error: { message: "simulated service unavailable" } }, 503)
    : response({});
  result = await ask({
    GEMINI_API_KEY: "test-key",
    AI: { run: async () => ({ response: "Fallback after Gemini 503" }) }
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.provider, "cloudflare-workers-ai");
  assert.match(result.data.text, /Fallback after Gemini 503/);
  assert.ok(result.data.attempted.some(x => x.provider === "gemini" && x.status === 503));

  // Intelligence regression: a timed-out primary provider should yield to a healthy fallback.
  globalThis.fetch = async (url) => {
    if (String(url).includes("generativelanguage.googleapis.com")) {
      throw new DOMException("simulated provider timeout", "AbortError");
    }
    return response({});
  };
  result = await ask({
    GEMINI_API_KEY: "test-key",
    AI: { run: async () => ({ response: "Fallback after Gemini timeout" }) }
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.provider, "cloudflare-workers-ai");
  assert.match(result.data.text, /Fallback after Gemini timeout/);

  globalThis.fetch = originalFetch;
  const health = await worker.fetch(new Request("https://worker.test/health"), {
    GEMINI_API_KEY: "secret-must-not-leak",
    GEMINI_API_KEY_3: "another-secret",
    AI: { run: async () => ({}) },
    GROQ_API_KEY: "groq-secret"
  });
  const healthData = await health.json();
  assert.equal(healthData.gemini_chat_key_slots[0], true);
  assert.equal(healthData.gemini_chat_key_slots[1], false);
  assert.equal(healthData.gemini_chat_key_slots[2], true);
  assert.equal(healthData.cloudflare_chat_configured, true);
  assert.equal(healthData.groq_chat_configured, true);
  assert.equal(JSON.stringify(healthData).includes("secret-must-not-leak"), false);

  let aiCalls = 0;
  globalThis.fetch = async (url) => String(url).includes("generativelanguage.googleapis.com") ? geminiQuota() : response({});
  const streamed = await askStream({
    GEMINI_API_KEY: "test-key",
    AI: { run: async () => {
      aiCalls++;
      if (aiCalls === 1) throw new Error("temporary Workers AI outage");
      return { response: "Recovered answer after retry" };
    } }
  });
  assert.equal(streamed.status, 200);
  const events = streamed.text.split(/\n/).filter(line => line.startsWith("data: ")).map(line => JSON.parse(line.slice(6)));
  const finalEvent = events.find(event => event.type === "result");
  assert.equal(finalEvent.status, 200);
  assert.equal(finalEvent.data.provider, "cloudflare-workers-ai");
  assert.match(finalEvent.data.text, /Recovered answer after retry/);
  assert.equal(aiCalls, 2);
  console.log("PASS: Gemini, Workers AI, Groq, OpenRouter failover; safe health configuration; and stream retry after transient total-provider failure.");
} finally {
  globalThis.fetch = originalFetch;
}
