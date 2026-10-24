#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${SOURCE_BRANCH:?SOURCE_BRANCH is required}"
: "${SOURCE_SHA:?SOURCE_SHA is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"

run_id=""
for attempt in $(seq 1 150); do
  build_runs="$(gh run list --repo "$GITHUB_REPOSITORY" --workflow build-apk.yml --branch "$SOURCE_BRANCH" --limit 20 --json databaseId,headSha,status,conclusion)"
  run_id="$(jq -r --arg sha "$SOURCE_SHA" '[.[] | select(.headSha == $sha and .status == "completed" and .conclusion == "success")][0].databaseId // empty' <<<"$build_runs")"
  if [ -n "$run_id" ]; then break; fi

  active="$(jq -r --arg sha "$SOURCE_SHA" 'any(.[]; .headSha == $sha and .status != "completed")' <<<"$build_runs")"
  finished="$(jq -r --arg sha "$SOURCE_SHA" 'any(.[]; .headSha == $sha and .status == "completed")' <<<"$build_runs")"
  if [ "$active" != "true" ] && [ "$finished" = "true" ]; then
    echo "No successful APK build exists for source SHA $SOURCE_SHA; matching build run(s) already completed unsuccessfully."
    jq -r --arg sha "$SOURCE_SHA" '.[] | select(.headSha == $sha) | [.databaseId, .status, (.conclusion // "none")] | @tsv' <<<"$build_runs"
    exit 1
  fi
  sleep 10
done

test -n "$run_id"
mkdir -p artifacts/apk
gh run download "$run_id" --repo "$GITHUB_REPOSITORY" --name MOSHARROF-AI-Android-APK --dir artifacts/apk
test -s artifacts/apk/app-debug.apk
