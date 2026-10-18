#!/usr/bin/env bash
set -euo pipefail
GATE_DIR="${1:?usage: persist_work_gate.sh <gate-dir>}"
RUN_ID="${GITHUB_RUN_ID:-local}"
LOG_REPO="${RUNNER_TEMP:-/tmp}/mosharrof-gate-ledger-${RUN_ID}"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
if git ls-remote --exit-code --heads origin automation-work-log >/dev/null 2>&1; then
  git fetch origin automation-work-log
  if [ -e "$LOG_REPO/.git" ]; then
    git -C "$LOG_REPO" fetch origin automation-work-log
    git -C "$LOG_REPO" reset --hard origin/automation-work-log
  else
    git worktree add --detach "$LOG_REPO" origin/automation-work-log
  fi
else
  git worktree add --detach "$LOG_REPO" HEAD
  git -C "$LOG_REPO" checkout --orphan automation-work-log
  git -C "$LOG_REPO" rm -rf . >/dev/null 2>&1 || true
fi
mkdir -p "$LOG_REPO/docs/automation/gates/runs/$RUN_ID"
cp "$GATE_DIR/gate-state.json" "$LOG_REPO/docs/automation/gates/runs/$RUN_ID/state.json"
cp "$GATE_DIR/gate-events.jsonl" "$LOG_REPO/docs/automation/gates/runs/$RUN_ID/events.jsonl"
python - "$GATE_DIR/gate-state.json" "$LOG_REPO/docs/automation/gates/latest-state.json" <<'PY'
import json, sys
from pathlib import Path
source, target = map(Path, sys.argv[1:])
current = json.loads(source.read_text(encoding="utf-8"))
previous = json.loads(target.read_text(encoding="utf-8")) if target.exists() else {}
if not previous.get("updated_at_utc") or current.get("updated_at_utc", "") >= previous.get("updated_at_utc", ""):
    target.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
PY
cat > "$LOG_REPO/docs/automation/gates/README.md" <<'EOF'
# Work Gate Ledger

Each run has a per-run state.json latest checkpoint and events.jsonl event history. latest-state.json points to the most recently persisted gate state. The active PR/main branch is not changed by these operational records.
EOF
git -C "$LOG_REPO" add docs/automation/gates
for ATTEMPT in $(seq 1 12); do
  if git -C "$LOG_REPO" diff --cached --quiet; then
    echo "Gate ledger already current."
    exit 0
  fi
  git -C "$LOG_REPO" commit -m "chore(automation): persist gate checkpoint $RUN_ID"
  if git -C "$LOG_REPO" push origin HEAD:refs/heads/automation-work-log; then
    exit 0
  fi
  echo "Gate ledger push raced; refreshing before retry $ATTEMPT/12."
  git fetch origin automation-work-log
  git -C "$LOG_REPO" reset --hard origin/automation-work-log
  mkdir -p "$LOG_REPO/docs/automation/gates/runs/$RUN_ID"
  cp "$GATE_DIR/gate-state.json" "$LOG_REPO/docs/automation/gates/runs/$RUN_ID/state.json"
  cp "$GATE_DIR/gate-events.jsonl" "$LOG_REPO/docs/automation/gates/runs/$RUN_ID/events.jsonl"
  python - "$GATE_DIR/gate-state.json" "$LOG_REPO/docs/automation/gates/latest-state.json" <<'PY'
import json, sys
from pathlib import Path
source, target = map(Path, sys.argv[1:])
current = json.loads(source.read_text(encoding="utf-8"))
previous = json.loads(target.read_text(encoding="utf-8")) if target.exists() else {}
if not previous.get("updated_at_utc") or current.get("updated_at_utc", "") >= previous.get("updated_at_utc", ""):
    target.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
PY
  git -C "$LOG_REPO" add docs/automation/gates
  RUN_JITTER=$(( (${GITHUB_RUN_ID:-0} + ATTEMPT * 17) % 11 ))
  sleep "$((ATTEMPT + RUN_JITTER))"
done
echo "Failed to persist gate checkpoint after twelve attempts." >&2
exit 1
