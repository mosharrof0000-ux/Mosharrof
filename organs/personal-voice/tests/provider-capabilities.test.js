import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseSpeechProvider,
  filterVoiceControls,
  resolveSpeechFallback
} from "../domain/provider-capabilities.js";

test("unsupported controls are never forwarded to a provider", () => {
  const result = filterVoiceControls(
    { speed: 1.1, pitch: 2, emotion: "warm", pause: 300 },
    { controls: { speed: true, emotion: true } }
  );
  assert.deepEqual(result, { speed: 1.1, emotion: "warm" });
});

test("Gemini remains the fallback when another provider fails", () => {
  assert.equal(chooseSpeechProvider({
    requestedProvider: "clone",
    availableProviders: ["gemini", "clone"]
  }), "clone");
  assert.equal(resolveSpeechFallback({
    requestedProvider: "clone",
    failedProvider: "clone",
    availableProviders: ["gemini", "clone"]
  }), "gemini");
  assert.equal(resolveSpeechFallback({
    requestedProvider: "gemini",
    failedProvider: "gemini",
    availableProviders: ["gemini"]
  }), null);
});
