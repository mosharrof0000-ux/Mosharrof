#!/usr/bin/env bash
set -euo pipefail
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
mkdir -p artifacts/retries
gh run download "$GITHUB_RUN_ID" --repo "$GITHUB_REPOSITORY" --pattern "mosharrof-apk-webview-real-chat-${GITHUB_RUN_ID}-attempt-*" --dir artifacts/retries
echo "Attempt artifacts and success markers:"
find artifacts/retries -name success-marker.txt -type f -print
marker="$(find artifacts/retries -name success-marker.txt -type f -print -quit)"
if [ -z "$marker" ]; then
  echo "::error::All three Android emulator attempts failed to prove a visible real-chat answer and screenshot. Inspect each attempt artifact before changing app code."
  exit 1
fi
echo "Verified success marker: $marker"
cat "$marker"
screenshot="$(find "$(dirname "$marker")" -maxdepth 1 -type f \( -iname "*.png" -o -iname "*.jpg" \) -print -quit)"
if [ -z "$screenshot" ]; then
  echo "::error::Success marker exists but no screenshot file is present in that attempt artifact."
  exit 1
fi
echo "Screenshot proof file: $screenshot"
