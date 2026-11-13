import test from "node:test";
import assert from "node:assert/strict";
import { createReadAloudController } from "../components/read-aloud.js";

test("saved catalog voice overrides provider only for the current message", async () => {
  const calls = [];
  class FakeAudio { play() { return Promise.resolve(); } pause() {} }
  const controller = createReadAloudController({
    fetchImpl: async (url, request) => {
      calls.push({ url, body: JSON.parse(request.body) });
      return { ok: true, json: async () => ({ provider: "azure", audio_data: "AQID", mime_type: "audio/wav" }) };
    },
    AudioCtor: FakeAudio,
    URLApi: { createObjectURL: () => "blob:catalog", revokeObjectURL() {} },
    storage: { getItem: key => key === "mosharrof_tts_provider_v1" ? "gemini" : "bn-BD-PradeepNeural" },
    BlobCtor: Blob,
    atobImpl: value => Buffer.from(value, "base64").toString("binary")
  });
  const button = { disabled: false, dataset: { voiceProvider: "azure", voiceId: "bn-BD-NabanitaNeural", voiceProfileDisabled: "true" } };
  await controller.speak("এই বার্তার ক্যাটালগ কণ্ঠ পরীক্ষা", button);
  assert.equal(calls[0].body.provider, "azure");
  assert.equal(calls[0].body.voice, "bn-BD-NabanitaNeural");
  controller.stop();
});

