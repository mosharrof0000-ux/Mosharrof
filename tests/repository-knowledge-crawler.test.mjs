import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const crawlerPath = fileURLToPath(new URL("../scripts/build-repository-knowledge-index.mjs", import.meta.url));

test("crawler creates a source-backed index from tracked text files without network access", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mosharrof-knowledge-"));
  try {
    const git = (...args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    assert.equal(git("init").status, 0);
    fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
    fs.writeFileSync(path.join(dir, "README.md"), "# Project overview\nThis project stores useful knowledge for the assistant.\n");
    fs.writeFileSync(path.join(dir, "docs", "notes.md"), "# Notes\nThe memory index helps answer repository questions.\n");
    fs.writeFileSync(path.join(dir, ".env"), "TOKEN=not-for-indexing\n");
    assert.equal(git("add", "-f", "README.md", "docs/notes.md", ".env").status, 0);
    const run = spawnSync(process.execPath, [crawlerPath], { cwd: dir, encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    const index = JSON.parse(run.stdout);
    assert.ok(index.entries.some(entry => entry.path === "README.md"));
    assert.ok(index.entries.some(entry => entry.path === "docs/notes.md"));
    assert.ok(!index.entries.some(entry => entry.path === ".env"));
    assert.equal(index.stats.skippedByCrawler.path, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
