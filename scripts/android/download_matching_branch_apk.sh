#!/usr/bin/env bash
set -euo pipefail
: "${GH_TOKEN:?GH_TOKEN required}"
: "${SOURCE_BRANCH:?SOURCE_BRANCH required}"
: "${SOURCE_SHA:?SOURCE_SHA required}"
run_id=""
for attempt in $(seq 1 150); do
  run_id="$(gh run list --repo "$GITHUB_REPOSITORY" --workflow build-apk.yml --branch "$SOURCE_BRANCH" --limit 20 --json databaseId,headSha,status,conclusion --jq 'first(.[] | select(.headSha == env.SOURCE_SHA and .status == "completed" and .conclusion == "success")) | .databaseId // empty')"
  [ -n "$run_id" ] && break
  sleep 10
done
test -n "$run_id"
mkdir -p artifacts/apk
gh run download "$run_id" --repo "$GITHUB_REPOSITORY" --name MOSHARROF-AI-Android-APK --dir artifacts/apk
test -s artifacts/apk/app-debug.apk
