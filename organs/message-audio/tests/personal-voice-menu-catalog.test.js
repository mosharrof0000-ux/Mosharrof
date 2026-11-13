import test from "node:test";
import assert from "node:assert/strict";
import { buildCatalogQuery, catalogVoiceUsable } from "../components/personal-voice-menu-catalog.js";

test("catalog query preserves name, language and style filters", () => {
  const query = buildCatalogQuery({ query: "বাংলা নারী", language: "bn-BD", style: "storyteller" });
  assert.equal(query.get("q"), "বাংলা নারী");
  assert.equal(query.get("language"), "bn-BD");
  assert.equal(query.get("style"), "storyteller");
});

test("catalog voices are usable only when server confirms all permission gates", () => {
  assert.equal(catalogVoiceUsable({ available: true }), true);
  assert.equal(catalogVoiceUsable({ available: false, license_status: "unknown" }), false);
  assert.equal(catalogVoiceUsable({ license_status: "verified", consent_status: "documented" }), false);
});
