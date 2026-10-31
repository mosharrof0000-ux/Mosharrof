import test from "node:test";
import assert from "node:assert/strict";
import { buildRepositoryKnowledgeIndex, searchRepositoryKnowledge, formatRepositoryKnowledgeAnswer } from "../core/repository-knowledge-index.js";

test("indexes repository files and classifies workflows, tests, docs and reports", () => {
  const index = buildRepositoryKnowledgeIndex([
    { path: ".github/workflows/ci.yml", summary: "continuous integration workflow", url: "https://github.com/example/repo/blob/main/.github/workflows/ci.yml" },
    { path: "tests/chat.test.mjs", summary: "chat behavior regression test" },
    { path: "docs/WORK_CHECKPOINT.md", summary: "latest project checkpoint" }
  ], { indexedAt: "2026-10-20T00:00:00.000Z" });
  assert.equal(index.stats.indexed, 3);
  assert.equal(index.entries.find(x => x.path.endsWith("ci.yml")).kind, "workflow");
  assert.equal(index.entries.find(x => x.path.startsWith("tests/")).kind, "test");
  assert.equal(index.entries.find(x => x.path.startsWith("docs/")).kind, "report");
});

test("search ranks path matches and retains source provenance", () => {
  const index = buildRepositoryKnowledgeIndex([
    { path: "core/personal-memory-engine.js", summary: "memory storage and recall", sourceUrl: "https://github.com/example/repo/blob/main/core/personal-memory-engine.js" },
    { path: "docs/android.md", summary: "Android UI notes" }
  ]);
  const result = searchRepositoryKnowledge(index, "personal memory", 5);
  assert.equal(result[0].path, "core/personal-memory-engine.js");
  assert.match(result[0].sourceUrl, /^https:\/\//);
  const answer = formatRepositoryKnowledgeAnswer(result, "personal memory");
  assert.equal(answer.sources.length, 1);
  assert.match(answer.answer, /প্রমাণ:/);
});

test("skips duplicate records, secret paths, and content containing recognizable tokens", () => {
  const index = buildRepositoryKnowledgeIndex([
    { path: "README.md", content: "safe overview" },
    { path: "README.md", content: "duplicate" },
    { path: ".env", content: "do not index" },
    { path: "docs/bad.md", content: "github_pat_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345" }
  ]);
  assert.equal(index.entries.length, 1);
  assert.equal(index.stats.skipped, 3);
});

test("empty and invalid queries behave safely; missing results do not pretend success", () => {
  const index = buildRepositoryKnowledgeIndex([{ path: "README.md", summary: "project overview" }]);
  assert.deepEqual(searchRepositoryKnowledge(index, "   "), []);
  const answer = formatRepositoryKnowledgeAnswer([], "latest failing test");
  assert.equal(answer.verified, false);
  assert.match(answer.answer, /প্রমাণ পাওয়া যায়নি/);
});

test("rejects malformed index and excessive input", () => {
  assert.throws(() => buildRepositoryKnowledgeIndex({}), /array/);
  assert.throws(() => searchRepositoryKnowledge({}, "query"), /Unsupported/);
  assert.throws(() => buildRepositoryKnowledgeIndex([{ path: "a" }, { path: "b" }], { maxRecords: 1 }), /limit/);
});
