import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseSpeechProvider,
  getProviderControlCapabilities,
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

test("only real provider controls are exposed", () => {
  assert.deepEqual(getProviderControlCapabilities("edge").controls, {
    speed: true, pitch: false, emotion: false, intensity: false, pause: false, emphasis: false
  });
  assert.deepEqual(getProviderControlCapabilities("indicf5").controls, {
    speed: false, pitch: false, emotion: false, intensity: false, pause: false, emphasis: false
  });
});

test("only IndicF5 advertises reference voice cloning capability", () => {
  assert.equal(getProviderControlCapabilities("indicf5").supportsVoiceCloning, true);
  assert.equal(getProviderControlCapabilities("gemini").supportsVoiceCloning, false);
});
