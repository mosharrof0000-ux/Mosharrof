import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../worker/video-generation/index.js", import.meta.url), "utf8");
const worker = (await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"))).default;

const origin = "https://mosharrof0000-ux.github.io";
const healthResponse = await worker.fetch(new Request("https://video.test/health", { headers: { Origin: origin } }), {});
assert.equal(healthResponse.status, 200);
const health = await healthResponse.json();
assert.equal(health.ok, true);
assert.equal(health.enabled, false);
assert.equal(health.provider_configured, false);

const disabledResponse = await worker.fetch(new Request("https://video.test/generate-video", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "A calm blue ocean", aspect_ratio: "16:9" })
}), { FAL_KEY: "must-not-be-used", VIDEO_GENERATION_ENABLED: "false" });
assert.equal(disabledResponse.status, 503);
assert.equal((await disabledResponse.json()).error, "video_generation_disabled");

const noKeyResponse = await worker.fetch(new Request("https://video.test/generate-video", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "A calm blue ocean" })
}), { VIDEO_GENERATION_ENABLED: "true" });
assert.equal(noKeyResponse.status, 503);
assert.equal((await noKeyResponse.json()).error, "video_provider_not_configured");

const emptyPromptResponse = await worker.fetch(new Request("https://video.test/generate-video", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: " " })
}), { FAL_KEY: "dummy", VIDEO_GENERATION_ENABLED: "true" });
assert.equal(emptyPromptResponse.status, 400);
assert.equal((await emptyPromptResponse.json()).error, "prompt_required");

const badOriginResponse = await worker.fetch(new Request("https://video.test/generate-video", {
  method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "A calm blue ocean" })
}), { FAL_KEY: "dummy", VIDEO_GENERATION_ENABLED: "true" });
assert.equal(badOriginResponse.status, 403);
console.log("SAFE VIDEO WORKER CONTRACT: PASS");
