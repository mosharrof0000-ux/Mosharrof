# MOSHARROF Repository Knowledge Crawler

## Purpose
Build a searchable, source-backed snapshot of tracked repository text files so MOSHARROF can retrieve file purpose, architecture notes, tests, workflows, and checkpoint/report content when an authorized caller provides the snapshot.

## Run locally or in CI
```sh
node scripts/build-repository-knowledge-index.mjs --out repository-knowledge-index.json
node --test tests/repository-knowledge-index.test.mjs
```

The crawler uses `git ls-files`, reads only tracked text files, and has no network access. It excludes common build/vendor folders, secret/config paths, non-text extensions, oversized files, binary content, and files containing recognizable credential patterns. It records source file paths and index timestamp. The generated JSON can contain project source and documentation: review it before uploading or sharing. Do not commit the generated snapshot by default.

## Knowledge quality and limitations
- The index is a snapshot, not a live connection to GitHub Actions or the deployed site.
- To answer "what is running now?" fetch the current workflow run first and cite its URL/time.
- To answer "what does this file do?" search the snapshot and cite the path/commit.
- Rebuild after repository changes. A future approved integration can import the snapshot into the personal-memory bridge.
- The crawler does not read user-private ChatGPT history, connected accounts, or GitHub secrets.
