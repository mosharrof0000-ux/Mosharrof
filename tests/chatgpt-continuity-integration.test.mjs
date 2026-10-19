import test from "node:test";
import assert from "node:assert/strict";
import { parseChatGPTExport, buildChatGPTStyleProfile } from "../web/runtime/core/chatgpt-conversation-import.js";

const sample = [{ id: "conv1", title: "Memory and work", mapping: {
  a: { message: { id: "m1", author: { role: "user" }, create_time: 1700000000, content: { parts: ["আমার আগের কাজ মনে রাখুন"] } } },
  b: { message: { id: "m2", author: { role: "assistant" }, create_time: 1700000001, content: { parts: ["অবশ্যই, ধাপে ধাপে এগোবো।"] } } },
  c: { message: { id: "m3", author: { role: "assistant" }, create_time: 1700000002, content: { parts: ["১. প্রথমে পরীক্ষা করুন।"] } } },
  d: { message: { id: "m4", author: { role: "assistant" }, create_time: 1700000003, content: { parts: ["২. তারপর ফলাফল যাচাই করুন।"] } } }
}}];

test("ChatGPT export parser extracts visible user/assistant messages in chronological order", () => {
  const snapshot = parseChatGPTExport(sample, { batchId: "test" });
  assert.equal(snapshot.preview.conversations, 1);
  assert.equal(snapshot.entries.length, 4);
  assert.equal(snapshot.entries[0].kind, "user");
  assert.equal(snapshot.entries[1].kind, "assistant");
  assert.equal(snapshot.entries[0].source.provider, "chatgpt");
  assert.equal(snapshot.entries[0].source.captureMethod, "user-export-import");
  assert.equal(snapshot.entries[0].previousId, null);
  assert.equal(snapshot.entries[1].previousId, snapshot.entries[0].id);
  assert.equal(snapshot.entries[2].previousId, snapshot.entries[1].id);
});

test("parser requires valid export and excludes tool/system records and credential-like messages", () => {
  assert.throws(() => parseChatGPTExport("{bad json"), /valid JSON/);
  assert.throws(() => parseChatGPTExport({ foo: "bar" }), /conversations.json/);
  const input = [{ mapping: {
    a: { message: { id: "x", author: { role: "system" }, content: { parts: ["system prompt"] } } },
    b: { message: { id: "y", author: { role: "user" }, content: { parts: ["আমার password হলো secret"] } } }
  }}];
  const snapshot = parseChatGPTExport(input);
  assert.equal(snapshot.entries.length, 0);
  assert.equal(snapshot.preview.skippedTurns, 2);
});

test("style profile remains a draft and needs enough visible assistant examples", () => {
  const snapshot = parseChatGPTExport(sample);
  const profile = buildChatGPTStyleProfile(snapshot);
  assert.equal(profile.status, "draft-user-review-required");
  assert.ok(profile.sampleCount >= 3);
  assert.ok(profile.rules.length > 0);
  assert.equal(buildChatGPTStyleProfile({ entries: [] }).status, "needs-more-examples");
});
