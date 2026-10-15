import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../worker/screenshot-analysis.js", import.meta.url), "utf8");
const worker = (await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"))).default;
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (url) => String(url).includes("generativelanguage.googleapis.com")
  ? response({ error: { message: "free tier image quota is zero" } }, 429)
  : response({});
const imageModels = [];
const request = new Request("https://worker.test/generate-image", {
  method: "POST",
  headers: { "Origin": "https://mosharrof0000-ux.github.io", "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "A simple abstract illustration with a blue circle and a yellow square on a white background.", aspect_ratio: "1:1" })
});
const result = await worker.fetch(request, {
  GEMINI_API_KEY: "test-key",
  AI: { run: async (model) => {
    imageModels.push(model);
    if (model === "@cf/black-forest-labs/flux-1-schnell") throw new Error("8007: Input prompt contains NSFW content");
    if (model === "@cf/bytedance/stable-diffusion-xl-lightning") return { image: "aW1hZ2U=" };
    throw new Error("simulated fallback model outage");
  } }
});
const data = await result.json();
assert.equal(result.status, 200);
assert.equal(data.provider, "cloudflare-workers-ai");
assert.equal(data.model, "@cf/bytedance/stable-diffusion-xl-lightning");
assert.deepEqual(imageModels, ["@cf/black-forest-labs/flux-1-schnell", "@cf/bytedance/stable-diffusion-xl-lightning"]);
console.log("PASS: image generation falls through from a FLUX moderation false-positive to SDXL Lightning.");
