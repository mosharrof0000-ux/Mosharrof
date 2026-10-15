import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../worker/screenshot-analysis.js", import.meta.url), "utf8");
const worker = (await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"))).default;
const models = [
  "@cf/zai-org/glm-4.7-flash",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/google/gemma-4-26b-a4b-it",
  "@cf/meta/llama-4-scout-17b-16e-instruct"
];
globalThis.fetch = async (url) => String(url).includes("generativelanguage.googleapis.com")
  ? new Response(JSON.stringify({ error: { message: "quota exceeded" } }), { status: 429, headers: { "content-type": "application/json" } })
  : new Response("{}");
async function ask(env) {
  const request = new Request("https://worker.test/chat", {
    method: "POST",
    headers: { "Origin": "https://mosharrof0000-ux.github.io", "Content-Type": "application/json" },
    body: JSON.stringify({ text: "বাংলায় একটি সংক্ষিপ্ত উত্তর দিন", stream_status: false })
  });
  const response = await worker.fetch(request, env);
  return { status: response.status, data: await response.json() };
}
for (let target = 0; target < models.length; target++) {
  const attempted = [];
  const result = await ask({
    GEMINI_API_KEY: "test-key",
    CLOUDFLARE_CHAT_MODELS: models.join(","),
    AI: { run: async model => {
      attempted.push(model);
      if (model === models[target]) return { response: "Fallback answer from " + model };
      throw new Error("simulated model unavailable");
    } }
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.provider, "cloudflare-workers-ai");
  assert.equal(result.data.model, models[target]);
  assert.deepEqual(attempted, models.slice(0, target + 1));
}
console.log("PASS: all four keyless Cloudflare chat models are tried in order and can recover after Gemini quota failure.");
