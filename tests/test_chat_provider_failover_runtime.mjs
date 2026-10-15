import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../worker/screenshot-analysis.js", import.meta.url), "utf8");
const moduleUrl = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const worker = (await import(moduleUrl)).default;
const originalFetch = globalThis.fetch;

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
function geminiQuota() {
  return response({ error: { message: "quota exceeded" } }, 429);
}
async function ask(env) {
  const request = new Request("https://worker.test/chat", {
    method: "POST",
    headers: { "Origin": "https://mosharrof0000-ux.github.io", "Content-Type": "application/json" },
    body: JSON.stringify({ text: "বাংলায় একটি সংক্ষিপ্ত উত্তর দিন", stream_status: false })
  });
  const res = await worker.fetch(request, env);
  return { status: res.status, data: await res.json() };
}
try {
  // Gemini primary success.
  globalThis.fetch = async (url) => String(url).includes("generativelanguage.googleapis.com")
    ? response({ candidates: [{ content: { parts: [{ text: "Gemini answer" }] } }] })
    : response({});
  let result = await ask({ GEMINI_API_KEY: "test-key" });
  assert.equal(result.status, 200);
  assert.equal(result.data.provider, "gemini");
  assert.match(result.data.text, /Gemini answer/);

  // Credential rotation: a quota-limited first Gemini key must not block another key.
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

  // Model rotation: an unsupported primary model should advance to the next Gemini model.
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

  // Exhausted Gemini must fall back to the keyless Workers AI binding.
  globalThis.fetch = async (url) => String(url).includes("generativelanguage.googleapis.com") ? geminiQuota() : response({});
  result = await ask({
    GEMINI_API_KEY: "test-key",
    AI: { run: async () => ({ response: "Workers AI answer" }) }
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.provider, "cloudflare-workers-ai");
  assert.match(result.data.text, /Workers AI answer/);
  assert.ok(result.data.attempted.some(x => x.provider === "gemini" && x.status === 429));

  // If Workers AI also fails, Groq must be attempted and can answer.
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

  // If Groq is rate-limited, OpenRouter must be attempted next.
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

  // Health must expose configured slots, never credential values.
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
  console.log("PASS: Gemini, Workers AI, Groq, OpenRouter failover and safe health configuration.");
} finally {
  globalThis.fetch = originalFetch;
}
