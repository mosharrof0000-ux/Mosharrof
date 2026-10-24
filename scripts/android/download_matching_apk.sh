#!/usr/bin/env bash
set -euo pipefail
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${SOURCE_BRANCH:?SOURCE_BRANCH is required}"
: "${SOURCE_SHA:?SOURCE_SHA is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
run_id=""
for attempt in $(seq 1 150); do
  matching="$(gh run list --repo "$GITHUB_REPOSITORY" --workflow build-apk.yml --branch "$SOURCE_BRANCH" --limit 20 --json databaseId,headSha,status,conclusion --jq 'first(.[] | select(.headSha == env.SOURCE_SHA))')"
  if [ -n "$matching" ] && [ "$matching" != "null" ]; then
    build_status="$(printf '%s' "$matching" | jq -r '.status')"
    build_conclusion="$(printf '%s' "$matching" | jq -r '.conclusion // ""')"
    if [ "$build_status" = "completed" ] && [ "$build_conclusion" = "success" ]; then
      run_id="$(printf '%s' "$matching" | jq -r '.databaseId')"
      break
    fi
    if [ "$build_status" = "completed" ] && [ "$build_conclusion" != "success" ]; then
      echo "::error::Matching APK build $SOURCE_SHA completed with conclusion '$build_conclusion'; failing fast."
      exit 1
    fi
  fi
  sleep 10
done
if [ -z "$run_id" ]; then
  echo "::error::No successful APK build for $SOURCE_SHA after 25 minutes."
  exit 1
fi
mkdir -p artifacts/apk
gh run download "$run_id" --repo "$GITHUB_REPOSITORY" --name MOSHARROF-AI-Android-APK --dir artifacts/apk
test -s artifacts/apk/app-debug.apk
