# Mosharrof Agent Working Rules

These rules apply to every coding agent, automation run, new task, resumed session, and repository page. Read this file before making changes.

## One problem, parallel independent solution lanes

For any failing check, bug, blocked task, or red status:

1. Define one problem statement and a measurable acceptance condition. Preserve the failing log, run URL, commit SHA, environment, and artifacts before changing anything.
2. Diagnose the evidence and list plausible root causes. Create separate, independently testable solution lanes for distinct hypotheses. Default to up to 10 lanes when there are 10 credible, useful hypotheses; use fewer when evidence supports fewer. Do not invent weak hypotheses just to reach 10.
3. Run independent lanes concurrently where resources permit. Each lane must have an isolated branch/worktree or other isolated workspace, a named hypothesis, one focused change, its own run/evidence, and a clear pass/fail result. Never let parallel lanes overwrite the same files or share unsafe mutable state.
4. Keep the scope to one user goal at a time. Parallelize approaches to that goal, not unrelated backlog items.
5. Use a bounded timeout, retry only for transient errors, and change the method when evidence shows a strategy is not addressing the cause. Re-running the same failing command without a diagnostic change is not a new strategy.
6. A green build is not necessarily a green feature. Verify the exact acceptance condition, including a real non-mock result where relevant. Keep emulator, browser, and physical-device evidence distinct.
7. When one lane passes the acceptance condition, independently verify the winning change and its evidence. Then request cancellation of redundant running lanes. Confirm cancellation where possible and preserve each lane's logs/artifacts before cleanup. A lane is not a winner merely because a workflow or build turns green.
8. Integrate only the verified winning fix into a clean, current feature branch/PR. Re-run required checks against the integrated result. Do not merge/deploy while mandatory checks are red, missing, skipped without justification, or unsupported by evidence.
9. If every lane fails, report the actual failure point, evidence, hypotheses ruled out, and the next materially different experiments. Do not label the problem solved.
10. Report the outcome with links to the PR, workflow runs, logs, screenshots/artifacts, and commit SHA. State separately what passed, failed, was skipped, and was not tested.

## Safety and repository protection

- Never make speculative destructive deletions. First identify the exact path, purpose, dependencies/references, and risk; prefer a reversible isolated PR.
- Never expose, copy into logs, or commit secrets, tokens, personal data, or credentials.
- Never bypass tests, alter a test to manufacture a pass, or replace a real integration check with a mock while claiming real success.
- Keep `main` and the Live site unchanged until an isolated change has passed review and all required gates.
- Do not automatically merge or deploy a winner unless repository policy explicitly authorizes it and all mandatory gates pass.
- Keep changes small and separated by component/feature (“one organ, one responsibility”).
- Resume from repository state and evidence, not assumptions from a previous chat. This file and the linked run artifacts are the durable handoff.

## Mosharrof Android real-chat example

For APK real-chat failures, consider distinct evidence-based lanes such as:
- artifact selection/download and APK hash integrity;
- ADB/emulator readiness and package-manager services;
- WebView target discovery and CDP WebSocket endpoint;
- app installation/launch and composer discovery;
- network/API/provider fallback;
- submission and verification of an actual non-mock assistant answer;
- screenshot capture and Live/APK viewport parity.

Only the end-to-end acceptance check proves real chat. APK build/install/launch alone does not.
