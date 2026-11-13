import test from "node:test";
import assert from "node:assert/strict";
import { TTS_ENDPOINT, PERSONAL_VOICE_ENDPOINT, createReadAloudController } from "../components/read-aloud.js";
import { cacheDefaultVoiceProfileId } from "../components/personal-voice-menu-api.js";

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

test("ordinary one-tap Read Aloud uses the saved default personal voice", async () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem(key) {
      if (key === "mosharrof_personal_voice_auth_v1") return JSON.stringify({ access_token: "owner-session-token-1234567890", expires_at: Math.floor(Date.now() / 1000) + 3600 });
      return null;
    },
    setItem() {}
  };
  const calls = [];
  class FakeAudio {
    play() { return Promise.resolve(); }
    pause() {}
  }
  const controller = createReadAloudController({
    fetchImpl: async (url, request) => {
      calls.push({ url: String(url), body: request.body ? JSON.parse(request.body) : null });
      if (String(url).endsWith("/profiles")) {
        return new Response(JSON.stringify({ profiles: [], default_profile_id: "123e4567-e89b-42d3-a456-426614174000" }), { status: 200 });
      }
      return new Response(JSON.stringify({ provider: "personal-voice", audio_data: "AQID", mime_type: "audio/wav" }), { status: 200 });
    },
    authTokenProvider: async () => "test-user-jwt-token-which-is-long-enough",
    AudioCtor: FakeAudio,
    URLApi: { createObjectURL: () => "blob:personal-voice", revokeObjectURL() {} },
    storage: { getItem: () => "auto" },
    BlobCtor: Blob,
    atobImpl: (value) => Buffer.from(value, "base64").toString("binary")
  });
  try {
    cacheDefaultVoiceProfileId(null);
    const button = { disabled: false, dataset: {} };
    const blob = await controller.speak("আমার সংরক্ষিত কণ্ঠ পরীক্ষা", button);
    assert.equal(blob.size, 3);
    assert.ok(calls[0].url.endsWith("/profiles"));
    assert.equal(calls[1].url, PERSONAL_VOICE_ENDPOINT + "/profiles/123e4567-e89b-42d3-a456-426614174000/synthesize");
    assert.equal(button.dataset.audioProvider, "personal-voice");
    controller.stop();
  } finally {
    cacheDefaultVoiceProfileId(null);
    globalThis.localStorage = previousStorage;
  }
});
