# MOSHARROF Work Gate and Interruption Recovery

## Gate protocol
Every task should enter through the gate, record progress checkpoints, then exit with a result. The gate writes:
- `gate-state.json`: latest durable resume state and exact next step.
- `gate-events.jsonl`: append-only sequence of enter/checkpoint/exit/interrupt/resume events.

Use `python scripts/automation/work_gate.py enter --task "Live QA" --purpose "verify chat interaction" --step "open live page"` before starting.
After each meaningful completed step, call `checkpoint --step "open live page" --details "next: open chat composer"`.
On normal completion, call `exit --step "all checks" --details "list evidence and remaining risks"`.
On a known stop, call `interrupt --reason mobile_hang --step "send test message" --details "emulator stopped responding"`. Allowed reasons: `quota_limit`, `mobile_hang`, `timeout`, `session_crash`, `cancelled`, `runner_lost`, `unknown`.
To resume, call `resume`; the saved `resume_from` is preserved. Read state and event ledger first and continue from that step, not from the beginning.

## Recovery guarantees and limits
The gate can recover only information that was checkpointed or captured by a completion event. A hard device/app crash cannot report its exact cause unless an external monitor records it; use `unknown` rather than inventing a cause. For durable recovery across runner/session loss, copy gate-state and event records to the dedicated `automation-work-log` branch at each checkpoint, not just at final exit. Keep production/main untouched while validating.

## Acceptance
- Enter, checkpoint, interrupt, resume, and exit preserve the expected status and resume point.
- The interruption reason is explicit and machine-readable.
- The durable remote ledger is updated before work begins and after meaningful checkpoints, so an abrupt stop does not erase the latest known state.
- A successful CI/emulator run does not prove a physical phone was tested.
