# Parallel Root-Cause Resolution System

## Purpose

Solve one reported problem quickly by testing multiple independent, evidence-based explanations at the same time, rather than serially trying one guess after another. This is a process contract for humans, agents, CI workflows, and resumed sessions.

## Operating model

```text
One red gate / one user goal
        |
        v
Capture baseline, logs, run URL, commit, artifacts
        |
        v
Diagnose and rank plausible root-cause hypotheses
        |
        v
Create isolated lanes (default concurrency target: up to 10)
        |
        +--> Lane A: hypothesis A -> focused fix -> acceptance test
        +--> Lane B: hypothesis B -> focused fix -> acceptance test
        +--> Lane C: hypothesis C -> focused fix -> acceptance test
        +--> ... only as many credible lanes as evidence supports
        |
        v
Candidate reports pass / fail / blocked with evidence
        |
        v
Independently verify first candidate that meets full acceptance
        |
        +--> Verification fails: candidate is not a winner; continue lanes
        |
        v
Record winner; cancel redundant running lanes; preserve artifacts
        |
        v
Integrate winner in an isolated PR and rerun required checks
        |
        v
Merge/deploy only under normal repository gates and review policy
```

## Rules for lanes

Every lane must include:

- **Hypothesis:** a distinct, falsifiable explanation for the same problem.
- **Evidence:** the log, error, test, source location, or observation that makes the hypothesis plausible.
- **Isolation:** a separate branch/worktree or otherwise isolated execution space. No concurrent writes to the same working tree or shared state.
- **One focused intervention:** do not bundle unrelated fixes, and do not change the acceptance test just to make it pass.
- **Acceptance command/check:** the exact test that decides whether the original problem is fixed.
- **Evidence package:** run URL and ID, commit SHA, relevant logs, artifact links, screenshots where useful, APK hash where relevant, and final result.
- **Status:** `PASS`, `FAIL`, `BLOCKED`, or `NOT TESTED`. Missing evidence is not a pass.

## Concurrency and first-success policy

- Aim for up to 10 concurrent lanes for a complex red gate, if there are enough distinct credible hypotheses and runner capacity. Start fewer for simple failures; expand only when logs justify new hypotheses.
- Lanes address the same acceptance condition using different explanations or techniques. They are not 10 unrelated tasks.
- A lane reporting green must be checked against the original acceptance condition. For an integration test, require a real end-to-end result, not merely a successful build, installation, page load, mock, or skipped test.
- The coordinator verifies the candidate independently before declaring a winner.
- After a verified winner exists, request cancellation of redundant active lanes, check cancellation outcomes, and preserve their diagnostic evidence. Do not cancel before verification, and do not discard a useful failed log.
- If cancellation permissions are missing, report that honestly; do not imply the other lanes stopped.
- If all lanes fail, compare evidence, eliminate disproven hypotheses, and launch a new round only with materially different approaches.
- Avoid resource contention: concurrency is bounded by runner capacity, API quotas, rate limits, device availability, and cost. Use locks or queues for shared devices and rate-limited services.

## Definition of done

A problem is done only when all applicable items are true:

1. The original failing acceptance condition now passes.
2. The result is tied to the exact commit and environment tested.
3. Evidence is retained and accessible.
4. The integrated candidate passes required regression, architecture, security, and visual checks.
5. The PR and merge/deploy state are reported accurately.
6. Physical-device claims have physical-device evidence. Emulator evidence is labeled as emulator evidence.
7. Unsuccessful, skipped, cancelled, or untested lanes are not described as successful.

## Mosharrof Android real-chat lane examples

For a failed APK WebView real-chat gate, independently test evidence-backed hypotheses such as:

1. Wrong/missing APK artifact or artifact download mismatch.
2. APK hash or branch/commit mismatch.
3. ADB transport or emulator framework not ready.
4. Package manager/input/settings service not ready.
5. WebView target discovery or CDP WebSocket endpoint wrong.
6. Transient CDP startup/connection timeout.
7. App install, launch, or permission state issue.
8. Composer locator/input event issue.
9. Network, API, provider quota, or fallback issue.
10. Real-answer detection or screenshot/evidence capture issue.

These are candidate hypotheses, not claims that all 10 causes exist. Inspect the current run first, prioritize the evidenced failure point, and adapt the lane set to the actual error.

## Current known related work

- Parallel Android real-chat QA proposal: [PR #822](https://github.com/mosharrof0000-ux/Mosharrof/pull/822)
- CDP reconnection and safe-area startup fix proposal: [PR #813](https://github.com/mosharrof0000-ux/Mosharrof/pull/813)

These PRs are separate proposals. This document does not claim their runtime checks passed or that the system is already enforced by every workflow. Workflow-level enforcement should be added and tested separately without weakening existing gates.
