import test from "node:test";
import assert from "node:assert/strict";
import { createIndicF5Request, getIndicF5Capabilities, synthesizeWithIndicF5 } from "../providers/indicf5.js";

test("IndicF5 exposes no unsupported voice controls or training", () => {
  const capabilities = getIndicF5Capabilities();
  assert.equal(capabilities.model_training, false);
  assert.deepEqual(capabilities.controls, {
    speed: false, pitch: false, emotion: false, intensity: false, pause: false, emphasis: false
  });
});

test("IndicF5 adapter validates transcript and reference audio before inference", () => {
  assert.throws(() => createIndicF5Request({
    text: "বাংলা", referenceText: "", audioBytes: new Uint8Array([1,2,3]), mimeType: "audio/wav"
  }), /indicf5_reference_text_limit/);
  assert.throws(() => createIndicF5Request({
    text: "বাংলা", referenceText: "বলা বাক্য", audioBytes: new Uint8Array([1,2,3]), mimeType: "audio/mp3"
  }), /indicf5_reference_audio_type/);
});

test("IndicF5 adapter requires HTTPS and a server-side bearer token", async () => {
  await assert.rejects(() => synthesizeWithIndicF5({
    endpoint: "http://example.com", token: "x".repeat(40), formData: new FormData()
  }), /indicf5_endpoint_not_configured/);
  await assert.rejects(() => synthesizeWithIndicF5({
    endpoint: "https://example.com", token: "short", formData: new FormData()
  }), /indicf5_token_not_configured/);
});

test("IndicF5 adapter returns bounded WAV bytes", async () => {
  const result = await synthesizeWithIndicF5({
    endpoint: "https://inference.example",
    token: "x".repeat(40),
    formData: new FormData(),
    fetchImpl: async (url, options) => {
      assert.equal(String(url), "https://inference.example/synthesize");
      assert.equal(options.headers.authorization, "Bearer " + "x".repeat(40));
      return new Response(new Uint8Array([1,2,3]), { status: 200, headers: { "content-type": "audio/wav" } });
    }
  });
  assert.equal(result.mimeType, "audio/wav");
  assert.deepEqual([...result.audio], [1,2,3]);
});
