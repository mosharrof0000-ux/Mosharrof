import test from "node:test";
import assert from "node:assert/strict";
import { createPersonalVoiceMenu } from "../components/personal-voice-menu.js";

test("personal voice menu attaches to the existing Read Aloud button and cleans up listeners", () => {
  const listeners = new Map();
  const button = {
    dataset: {},
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name) { listeners.delete(name); }
  };
  const dispose = createPersonalVoiceMenu({
    button, message: "বাংলা পরীক্ষা", controller: { speak() {}, stop() {} },
    documentRef: {}, getProviderControlCapabilities: async () => ({ controls: {} })
  });
  assert.ok(listeners.has("pointerdown"));
  assert.ok(listeners.has("pointerup"));
  assert.ok(listeners.has("contextmenu"));
  assert.equal(listeners.size, 5);
  dispose();
  assert.equal(listeners.size, 0);
});

test("menu long-press and context-menu handlers are attached to the existing button only", () => {
  const listeners = new Map();
  const button = {
    dataset: {},
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name) { listeners.delete(name); }
  };
  const dispose = createPersonalVoiceMenu({ button, message: "test", controller: {}, documentRef: {} });
  assert.equal([...listeners.keys()].includes("click"), false);
  assert.equal([...listeners.keys()].includes("pointerdown"), true);
  assert.equal([...listeners.keys()].includes("contextmenu"), true);
  dispose();
});
