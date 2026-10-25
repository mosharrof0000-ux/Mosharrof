#!/usr/bin/env bash
set -euo pipefail
: "${GH_TOKEN:?GH_TOKEN required}"
: "${QA_STRATEGY_NAME:?QA_STRATEGY_NAME required}"
jobs="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID/jobs" --paginate --jq '.jobs[] | select(.status == "in_progress") | [.id, .name] | @tsv')"
while IFS=$'\t' read -r id name; do
  [ -n "${id:-}" ] || continue
  [[ "$name" == *"— installed APK real-chat" ]] || continue
  [[ "$name" == "$QA_STRATEGY_NAME — installed APK real-chat" ]] && continue
  echo "First verified green lane: $QA_STRATEGY_NAME; cancelling redundant lane: $name ($id)"
  gh api --method POST "repos/$GITHUB_REPOSITORY/actions/jobs/$id/cancel"
done <<< "$jobs"
