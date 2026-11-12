import test from "node:test";
import assert from "node:assert/strict";
import { handlePersonalVoiceRequest, PERSONAL_VOICE_LIMITS } from "./personal-voice.js";

test("personal voice health reports readiness flags without exposing secrets", async () => {
  const response = await handlePersonalVoiceRequest(
    new Request("https://worker.example/personal-voice/health"),
    { PERSONAL_VOICE_ENCRYPTION_KEY: "do-not-disclose" }
  );
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.enabled, false);
  assert.equal(data.auth_configured, false);
  assert.equal(JSON.stringify(data).includes("do-not-disclose"), false);
});

test("personal voice endpoints reject missing user JWT", async () => {
  const response = await handlePersonalVoiceRequest(
    new Request("https://worker.example/personal-voice/profiles")
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "registered_owner_authentication_required");
});

test("non-personal-voice routes are not intercepted", async () => {
  const response = await handlePersonalVoiceRequest(new Request("https://worker.example/tts"));
  assert.equal(response, null);
});

test("upload and synthesis limits are bounded", () => {
  assert.equal(PERSONAL_VOICE_LIMITS.sampleBytes, 5 * 1024 * 1024);
  assert.equal(PERSONAL_VOICE_LIMITS.synthesisTextChars, 800);
  assert.equal(PERSONAL_VOICE_LIMITS.referenceTextChars, 500);
});
