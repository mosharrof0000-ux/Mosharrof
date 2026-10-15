import test from "node:test";
import assert from "node:assert/strict";
import { createPreferenceIntelligence } from "../index.js";

test("stores explicit preferences and returns global plus requested scope", () => {
  const prefs = createPreferenceIntelligence();
  assert.equal(prefs.recordPreference({ key: "color.accent", value: "soft green", scope: "presentation" }).stored, true);
  prefs.recordPreference({ key: "voice.speed", value: "slightly slower", scope: "voice" });
  assert.equal(prefs.getPreferences({ scope: "presentation" }).length, 1);
  assert.equal(prefs.getPreferences({ scope: "voice" }).length, 1);
});

test("rejects unsafe keys, empty values, unknown scopes and invalid confidence", () => {
  const prefs = createPreferenceIntelligence();
  assert.throws(() => prefs.recordPreference({ key: "../other-organ", value: "x" }));
  assert.throws(() => prefs.recordPreference({ key: "theme", value: " " }));
  assert.throws(() => prefs.recordPreference({ key: "theme", value: "green", scope: "outside" }));
  assert.throws(() => prefs.recordPreference({ key: "theme", value: "green", confidence: 2 }));
});

test("rejects low-confidence inference and protects explicit preference", () => {
  const prefs = createPreferenceIntelligence();
  assert.throws(() => prefs.recordPreference({ key: "color.accent", value: "blue", source: "inferred", confidence: 0.4 }));
  prefs.recordPreference({ key: "color.accent", value: "soft green", source: "explicit", scope: "presentation" });
  const result = prefs.recordPreference({ key: "color.accent", value: "red", source: "inferred", confidence: 0.9, scope: "presentation" });
  assert.equal(result.stored, false);
  assert.equal(prefs.getPreferences({ scope: "presentation" })[0].value, "soft green");
});

test("correction wins and forgetting is scoped", () => {
  const prefs = createPreferenceIntelligence();
  prefs.recordPreference({ key: "layout.grouping", value: "compact", scope: "presentation" });
  prefs.correctPreference({ key: "layout.grouping", value: "grouped", scope: "presentation" });
  assert.equal(prefs.getPreferences({ scope: "presentation" })[0].source, "corrected");
  prefs.recordPreference({ key: "layout.grouping", value: "grouped", scope: "voice" });
  assert.equal(prefs.forgetPreference("layout.grouping", "presentation"), true);
  assert.equal(prefs.getPreferences({ scope: "voice" }).length, 1);
});

test("returned values cannot mutate the stored preference", () => {
  const prefs = createPreferenceIntelligence();
  prefs.recordPreference({ key: "color.accent", value: "soft green", scope: "presentation" });
  const read = prefs.getPreferences({ scope: "presentation" });
  read[0].value = "hacked";
  assert.equal(prefs.getPreferences({ scope: "presentation" })[0].value, "soft green");
});
