#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${SOURCE_BRANCH:?SOURCE_BRANCH is required}"
: "${SOURCE_SHA:?SOURCE_SHA is required}"
: "${SOURCE_BASE_SHA:?SOURCE_BASE_SHA is required}"

mkdir -p artifacts/apk artifacts/apk-webview-chat
changed_files="$(git diff --name-only "${SOURCE_BASE_SHA}...${SOURCE_SHA}")"
if printf '%s\n' "$changed_files" | grep -Eq '^(android/|web/|organs/|entities/|core/|native/|config/|scripts/android/|scripts/prepare_web_organ_runtime\.py$|scripts/mosharrof_registry\.py$|scripts/manual_provider_runtime_patch\.py$|scripts/mosharrof_size_gate\.py$|\.github/workflows/build-apk\.yml$)'; then
  selection_reason="exact_head_build_required"
  echo "APK-affecting source changes detected; require a successful build for exact head $SOURCE_SHA."
  run_id=""
  for attempt in $(seq 1 90); do
    run_id="$(gh run list --repo "$GITHUB_REPOSITORY" --workflow build-apk.yml --branch "$SOURCE_BRANCH" --limit 20 --json databaseId,headSha,status,conclusion --jq 'first(.[] | select(.headSha == env.SOURCE_SHA and .status == "completed" and .conclusion == "success")) | .databaseId // empty')"
    if [ -n "$run_id" ]; then break; fi
    sleep 10
  done
  if [ -z "$run_id" ]; then
    echo "::error::APK-affecting changes were detected, but no successful exact-head APK build appeared within 15 minutes."
    exit 1
  fi
else
  selection_reason="main_apk_for_harness_only_change"
  echo "No APK build inputs changed; using the latest successful main APK for this harness-only change."
  run_id="$(gh run list --repo "$GITHUB_REPOSITORY" --workflow build-apk.yml --branch main --status success --limit 1 --json databaseId --jq '.[0].databaseId // empty')"
  if [ -z "$run_id" ]; then
    echo "::error::No successful main APK build is available for this harness-only change."
    exit 1
  fi
fi

gh run view "$run_id" --repo "$GITHUB_REPOSITORY" --json databaseId,headSha,headBranch,name,conclusion \
  | jq --arg requested_source_sha "$SOURCE_SHA" --arg selection_reason "$selection_reason" \
      '{run_id: .databaseId, head_sha: .headSha, branch: .headBranch, workflow: .name, conclusion: .conclusion, requested_source_sha: $requested_source_sha, selection_reason: $selection_reason}' \
  > artifacts/apk-webview-chat/apk-source.json
gh run download "$run_id" --repo "$GITHUB_REPOSITORY" --name MOSHARROF-AI-Android-APK --dir artifacts/apk
test -s artifacts/apk/app-debug.apk
