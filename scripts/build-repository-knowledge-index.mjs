#!/usr/bin/env node
/**
 * Build a local, source-backed knowledge snapshot from tracked files.
 * Writes to stdout or --out <path>. It never fetches network resources and
 * deliberately skips secret/config paths, binary files, oversized files and
 * recognizable credentials. Review generated snapshots before sharing them.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { buildRepositoryKnowledgeIndex } from "../core/repository-knowledge-index.js";

const args = process.argv.slice(2);
const outFlag = args.indexOf("--out");
const outPath = outFlag >= 0 ? args[outFlag + 1] : null;
const maxBytesArg = args.indexOf("--max-file-bytes");
const maxFileBytes = maxBytesArg >= 0 ? Math.max(512, Math.min(120000, Number(args[maxBytesArg + 1]) || 24000)) : 24000;
const root = process.cwd();
const excluded = /(^|\/)(\.git|node_modules|dist|build|coverage|\.next|\.venv|venv|vendor|\.cache)(\/|$)/i;
const sensitivePath = /(^|\/)(\.env(?:\.|$)|secrets?(?:\/|\.|$)|credentials?(?:\/|\.|$)|id_rsa|.*\.(?:pem|key|p12|pfx|keystore)$)/i;
const textExtensions = new Set([".md",".mdx",".txt",".rst",".js",".mjs",".cjs",".ts",".tsx",".jsx",".json",".yml",".yaml",".toml",".py",".html",".css",".scss",".xml",".kt",".java",".go",".rs",".sh",".ps1",".sql"]);
const credential = /(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AIza[0-9A-Za-z_-]{30,})/;

function category(file) {
  if (/^\.github\/workflows\//i.test(file)) return "workflow";
  if (/(^|\/)(tests?|__tests__)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/i.test(file)) return "test";
  if (/(report|artifact|health|status|checkpoint|incident|failure|summary)/i.test(file)) return "report";
  if (/\.(md|mdx|txt|rst)$/i.test(file)) return "documentation";
  if (/\.(ya?ml|json|toml)$/i.test(file)) return "configuration";
  if (/\.(mjs|cjs|js|ts|tsx|jsx|py|java|kt|go|rs|html|css|scss|xml|sh|sql)$/i.test(file)) return "source";
  return "file";
}
const paths = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }).split("\0").filter(Boolean);
const records = [];
const skipped = { path: 0, extension: 0, size: 0, binary: 0, credential: 0, readError: 0 };
for (const relative of paths) {
  const file = relative.replace(/\\/g, "/");
  if (excluded.test(file) || sensitivePath.test(file)) { skipped.path++; continue; }
  if (!textExtensions.has(path.extname(file).toLowerCase())) { skipped.extension++; continue; }
  const absolute = path.resolve(root, file);
  if (!absolute.startsWith(root + path.sep)) { skipped.path++; continue; }
  try {
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile() || stat.size > maxFileBytes) { skipped.size++; continue; }
    const content = fs.readFileSync(absolute, "utf8");
    if (content.includes("\u0000")) { skipped.binary++; continue; }
    if (credential.test(content)) { skipped.credential++; continue; }
    const title = file.split("/").pop();
    const summary = content.split(/\r?\n/).map(line => line.trim().replace(/^#+\s*/, "")).find(line => line.length > 10 && !/^import\s|^export\s|^\/\//.test(line)) || "";
    records.push({ id: file, path: file, title, kind: category(file), summary: summary.slice(0, 700), content: content.slice(0, 12000), source: "tracked-repository-file" });
  } catch { skipped.readError++; }
}
const index = buildRepositoryKnowledgeIndex(records);
index.stats.skippedByCrawler = skipped;
index.stats.trackedFilesSeen = paths.length;
index.repository = process.env.GITHUB_REPOSITORY || null;
index.commit = process.env.GITHUB_SHA || null;
const output = JSON.stringify(index, null, 2) + "\n";
if (outPath) fs.writeFileSync(path.resolve(root, outPath), output, { mode: 0o600 });
else process.stdout.write(output);
console.error(JSON.stringify({ indexed: index.stats.indexed, trackedFilesSeen: paths.length, skipped: index.stats.skipped, skippedByCrawler: skipped }));
