import test from "node:test";
import assert from "node:assert/strict";
import {
  TTS_ENDPOINT,
  normalizeSpeechText,
  extractMessageText,
  decodeAudioBlob,
  createReadAloudController
} from "../components/read-aloud.js";

test("normalizes message markdown without losing visible words", () => {
  assert.equal(normalizeSpeechText("**বাংলা** [লিংক](https://example.com) `কোড`"), "বাংলা লিংক কোড");
});

test("extracts message content without action controls", () => {
  const content = {
    cloneNode() {
      return {
        innerText: "আমার পাঠানো কথা",
        textContent: "আমার পাঠানো কথা",
        querySelectorAll() { return [{ remove() {} }]; }
      };
    }
  };
  assert.equal(extractMessageText(content), "আমার পাঠানো কথা");
});

test("decodes generated audio bytes into a typed Blob", () => {
  const blob = decodeAudioBlob("AQID", "audio/mpeg", {
    BlobCtor: Blob,
    atobImpl: (value) => Buffer.from(value, "base64").toString("binary")
  });
  assert.equal(blob.type, "audio/mpeg");
  assert.equal(blob.size, 3);
});

test("uses the existing TTS worker and stored provider/voice preferences", async () => {
  const calls = [];
  class FakeAudio {
    constructor(url) { this.url = url; }
    play() { return Promise.resolve(); }
    pause() {}
  }
  const controller = createReadAloudController({
    fetchImpl: async (url, request) => {
      calls.push({ url, request });
      return { ok: true, json: async () => ({ audio_data: "AQID", mime_type: "audio/mpeg" }) };
    },
    AudioCtor: FakeAudio,
    URLApi: { createObjectURL: () => "blob:generated", revokeObjectURL() {} },
    storage: { getItem: (key) => key === "mosharrof_tts_provider_v1" ? "gemini" : "bn-BD-NabanitaNeural" },
    BlobCtor: Blob,
    atobImpl: (value) => Buffer.from(value, "base64").toString("binary")
  });
  const button = { textContent: "🔊 পড়ে শোনান", disabled: false, dataset: {} };
  const blob = await controller.speak("বাংলা বার্তা", button);
  assert.equal(blob.size, 3);
  assert.equal(calls[0].url, TTS_ENDPOINT);
  const body = JSON.parse(calls[0].request.body);
  assert.equal(body.text, "বাংলা বার্তা");
  assert.equal(body.provider, "gemini");
  assert.equal(body.voice, "bn-BD-NabanitaNeural");
  assert.equal(body.language_code, "bn-BD");
  controller.stop();
});

test("falls back to browser speech when server TTS fails", async () => {
  let spoken = null;
  class FakeUtterance { constructor(text) { this.text = text; } }
  const controller = createReadAloudController({
    fetchImpl: async () => { throw new Error("offline"); },
    speechSynthesisRef: { speak: (utterance) => { spoken = utterance; }, cancel() {} },
    UtteranceCtor: FakeUtterance,
    storage: { getItem: () => "auto" }
  });
  const button = { textContent: "🔊 পড়ে শোনান", disabled: false, dataset: {} };
  const result = await controller.speak("পাঠানো কথা", button);
  assert.equal(result, null);
  assert.equal(spoken.text, "পাঠানো কথা");
  assert.equal(spoken.lang, "bn-BD");
  controller.stop();
});
