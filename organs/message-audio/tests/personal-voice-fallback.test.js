import test from "node:test";
import assert from "node:assert/strict";
import { TTS_ENDPOINT, createReadAloudController } from "../components/read-aloud.js";

test("personal voice failures fall back to the existing Gemini TTS route", async () => {
  const calls = [];
  class FakeAudio {
    constructor(url) { this.url = url; }
    play() { return Promise.resolve(); }
    pause() {}
  }
  const controller = createReadAloudController({
    fetchImpl: async (url, request) => {
      calls.push({ url, body: request.body ? JSON.parse(request.body) : null });
      if (url.includes("/personal-voice/")) return { ok: false, json: async () => ({ error: "personal_voice_inference_unavailable" }) };
      return { ok: true, json: async () => ({ audio_data: "AQID", mime_type: "audio/wav" }) };
    },
    authTokenProvider: async () => "test-user-jwt-token-which-is-long-enough",
    AudioCtor: FakeAudio,
    URLApi: { createObjectURL: () => "blob:gemini-fallback", revokeObjectURL() {} },
    storage: { getItem: () => "auto" },
    BlobCtor: Blob,
    atobImpl: (value) => Buffer.from(value, "base64").toString("binary")
  });
  const button = { textContent: "🔊 পড়ে শোনান", disabled: false, dataset: { voiceProfileId: "123e4567-e89b-42d3-a456-426614174000" } };
  const blob = await controller.speak("বাংলা বার্তা", button);
  assert.equal(blob.size, 3);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.includes("/personal-voice/"));
  assert.equal(calls[1].url, TTS_ENDPOINT);
  assert.equal(calls[1].body.provider, "gemini");
  controller.stop();
});
