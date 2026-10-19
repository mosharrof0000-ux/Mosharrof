import test from "node:test";
import assert from "node:assert/strict";
import { parseChatGPTExport, buildChatGPTStyleProfile } from "../core/chatgpt-conversation-import.js";

function fixture() {
  return [{
    id: "conv-1",
    title: "Mosharrof work",
    mapping: {
      a: { message: { id: "m-user", author: { role: "user" }, create_time: 1700000000, content: { content_type: "text", parts: ["বাংলায় বুঝিয়ে দিন"] } } },
      b: { message: { id: "m-assistant", author: { role: "assistant" }, create_time: 1700000001, content: { content_type: "text", parts: ["## ধাপ ১\n- প্রথমে পরীক্ষা করুন\n- তারপর ফলাফল দিন"] } } },
      c: { message: { id: "m-system", author: { role: "system" }, create_time: 1700000002, content: { content_type: "text", parts: ["must not import"] } } },
      d: { message: { id: "m-secret", author: { role: "user" }, create_time: 1700000003, content: { content_type: "text", parts: ["my password is example123"] } } }
    }
  }];
}

test("parses visible user/assistant turns and skips system plus credential-like text", () => {
  const result = parseChatGPTExport(fixture(), { batchId: "fixture" });
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.preview.conversations, 1);
  assert.equal(result.preview.importedTurns, 2);
  assert.equal(result.preview.skippedTurns, 1);
  assert.deepEqual(result.entries.map(row => row.kind), ["user", "assistant"]);
  assert.equal(result.entries[0].source.provider, "chatgpt");
  assert.equal(result.entries[0].source.importBatchId, "fixture");
  assert.match(result.entries[1].text, /প্রথমে পরীক্ষা করুন/);
});

test("accepts JSON strings and rejects invalid or unsupported exports", () => {
  assert.equal(parseChatGPTExport(JSON.stringify(fixture())).entries.length, 2);
  assert.throws(() => parseChatGPTExport("{bad json"), /valid JSON/);
  assert.throws(() => parseChatGPTExport({ nope: true }), /conversations.json/);
});

test("deduplicates duplicate message IDs within the import batch", () => {
  const data = fixture();
  data.push(data[0]);
  const result = parseChatGPTExport(data, { batchId: "dup" });
  assert.equal(result.entries.length, 2);
  assert.equal(result.preview.skippedTurns, 4);
});

test("style profile requires enough examples and produces editable observable rules", () => {
  assert.equal(buildChatGPTStyleProfile({ entries: [] }).status, "needs-more-examples");
  const result = parseChatGPTExport([{
    id: "styles",
    mapping: Object.fromEntries(Array.from({ length: 3 }, (_, i) => [String(i), {
      message: { id: "a" + i, author: { role: "assistant" }, create_time: 1700000000 + i,
        content: { content_type: "text", parts: ["## ধাপ " + i + "\n- কাজ করুন\n- যাচাই করুন"] } }
    }]))
  }], { batchId: "style" });
  const profile = buildChatGPTStyleProfile(result);
  assert.equal(profile.status, "draft-user-review-required");
  assert.ok(profile.rules.some(rule => rule.key === "language"));
  assert.ok(profile.rules.some(rule => rule.key === "structure"));
  assert.ok(profile.rules.some(rule => rule.key === "headings"));
});
