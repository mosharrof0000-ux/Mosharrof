#!/usr/bin/env bash
# Dispatch only registered autonomous workers; do not treat CI/recorders as task workers.
set -euo pipefail
REGISTRY="${1:-.github/automation/project-workers.json}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GH_REPO:?GH_REPO is required}"
now="$(date -u +%s)"
jq -e '.version == 1 and (.workers | type == "array")' "$REGISTRY" >/dev/null

while IFS=$'\t' read -r project repo workflow stale dispatch; do
  echo "=== $project ($repo / $workflow) ==="
  if ! response="$(gh api "repos/$repo/actions/workflows/$workflow/runs?per_page=20" 2>&1)"; then
    echo "STATUS=UNAVAILABLE; no dispatch; check repository/workflow access"
    printf '%s\n' "$response" | tail -n 2
    continue
  fi
  active="$(jq '[.workflow_runs[]? | select(.status == "queued" or .status == "in_progress")] | length' <<<"$response")"
  latest="$(jq -c '.workflow_runs[0] // empty' <<<"$response")"
  if [ "$active" -gt 0 ]; then
    echo "STATUS=ACTIVE; duplicate dispatch suppressed"
    continue
  fi
  if [ "$dispatch" != "true" ]; then
    echo "STATUS=OBSERVE_ONLY; registered workflow is not a task worker"
    continue
  fi
  if [ -z "$latest" ]; then
    age="$stale"
    conclusion="never_run"
  else
    created="$(jq -r '.created_at' <<<"$latest")"
    conclusion="$(jq -r '.conclusion // "running"' <<<"$latest")"
    age=$((now - $(date -u -d "$created" +%s)))
  fi
  if [ "$age" -lt "$stale" ]; then
    echo "STATUS=RECENT; age=${age}s; no dispatch"
    continue
  fi
  echo "STATUS=STALE; last_conclusion=$conclusion; dispatching one worker cycle"
  if gh workflow run "$workflow" --repo "$repo" --ref main; then
    echo "RECOVERY=DISPATCHED"
  else
    echo "RECOVERY=BLOCKED; verify cross-repository Actions:write permission and workflow_dispatch"
  fi
done < <(jq -r '.workers[] | [.project, .repository, .workflow, (.stale_after_seconds|tostring), (.dispatch|tostring)] | @tsv' "$REGISTRY")
