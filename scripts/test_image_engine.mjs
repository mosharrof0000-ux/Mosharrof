import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("web/index.html", "utf8");
const match = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match, "web/index.html must contain the application script");
const script = match[1];
new Function(script); // Parse the full inline app script without running browser code.

function extractFunction(startMarker, endMarker) {
  const start = script.indexOf(startMarker);
  const end = script.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, "Missing expected function: " + startMarker);
  return script.slice(start, end);
}

const parseImageSpec = new Function(
  extractFunction("  function parseImageSpec(prompt){", "  function imageReply(t){") +
  "; return parseImageSpec;"
)();
const looksLikeImagePrompt = new Function(
  extractFunction("  function looksLikeImagePrompt(t){", "  function imageReply(t){") +
  "; return looksLikeImagePrompt;"
)();

const cases = [
  {
    prompt: "একটি YouTube thumbnail বানাও। 4K HD, 16:9 ratio, 3840×2160, cinematic, কোনো লেখা নয়।",
    expected: { width: 3840, height: 2160, aspect_ratio: "16:9", image_size: "4K", transparent: false }
  },
  {
    prompt: "TikTok/YouTube Shorts vertical image, 4K, 9:16 ratio, 2160×3840",
    expected: { width: 2160, height: 3840, aspect_ratio: "9:16", image_size: "4K", transparent: false }
  },
  {
    prompt: "Website image 300×200 pixels, WebP, under 1MB",
    expected: { width: 300, height: 200, aspect_ratio: "3:2", format: "image/webp", max_bytes: 1000000 }
  },
  {
    prompt: "100×100 pixels PNG icon, transparent background, under 1MB",
    expected: { width: 100, height: 100, aspect_ratio: "1:1", format: "image/png", transparent: true, max_bytes: 1000000 }
  },
  {
    prompt: "Cinematic panoramic image, 21:9 ratio, 4K, ultra HD",
    expected: { width: 3840, height: 1646, aspect_ratio: "7:3", image_size: "4K", transparent: false }
  }
];

for (const { prompt, expected } of cases) {
  const actual = parseImageSpec(prompt);
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(actual[key], value, prompt + " -> " + key);
  }
}

const detectionCases = [
  ["500×300 PNG under 1MB", true],
  ["একটি YouTube thumbnail বানাও 4K 16:9", true],
  ["TikTok 9:16 vertical image", true],
  ["100×100 transparent PNG", true],
  ["Hello, can you help me with my homework?", false]
];
for (const [prompt, expected] of detectionCases) {
  assert.equal(looksLikeImagePrompt(prompt), expected, "prompt detection: " + prompt);
}

assert.ok(script.includes("function removeEdgeWhiteBackground(canvas)"), "transparent background handler must exist");
assert.ok(script.includes("image_size_limit_unmet:"), "file-size failures must be explicit");
console.log("Image Engine checks passed: inline syntax, 5 spec cases, 5 prompt-detection cases, transparency and file-size guards.");
