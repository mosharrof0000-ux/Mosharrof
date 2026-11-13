import test from "node:test";
import assert from "node:assert/strict";
import { createPersonalVoiceMenu } from "../components/personal-voice-menu.js";
import { testPersonalVoiceProfile } from "../components/personal-voice-menu-profiles.js";

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


test("active personal voice profile test action calls Read Aloud with the selected profile", async () => {
  const calls = [];
  const controller = { speak: async (...args) => { calls.push(args); return new Blob(["audio"]); } };
  const button = { dataset: {} };
  const profile = { id: "123e4567-e89b-42d3-a456-426614174000", name: "আমার কণ্ঠ", status: "active" };
  const audio = await testPersonalVoiceProfile({ controller, button, profile });
  assert.equal(audio.size, 5);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], button);
  assert.deepEqual(calls[0][2], { profileId: profile.id });
  assert.match(calls[0][0], /ব্যক্তিগত কণ্ঠের পরীক্ষা/);
});

test("draft or revoked profile cannot be tested", async () => {
  await assert.rejects(
    testPersonalVoiceProfile({ controller: { speak() {} }, button: { dataset: {} }, profile: { id: "x", status: "draft" } }),
    /active_personal_voice_profile_required/
  );
});
