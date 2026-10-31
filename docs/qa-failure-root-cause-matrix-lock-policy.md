# QA Failure Root-Cause Matrix and Lock Policy

Status: proposed repository rule; effective after review and merge.

## Mandatory response to a failed/blocked/skipped QA gate

1. **Preserve evidence first.** Record workflow/run/job IDs, commit SHA, branch, event, failed step, exit code, relevant logs, screenshots, and artifacts. Do not label a skipped job as a test failure or a passing unrelated workflow as proof that the failed gate passed.
2. **Build a root-cause matrix.** Identify the primary/root cause and at least 3–5 plausible independent contributing causes when evidence supports them. Include evidence, confidence, and a falsification test for each. Do not pad the list with invented causes; if fewer are plausible, state why.
3. **Isolate candidate fixes.** Create separate branches from the same known-safe base/failed commit, one hypothesis/fix per branch. Never make competing fixes together on main. Give each branch a clear name and link.
4. **Run an independent targeted test for each branch.** Keep run IDs and links in the matrix. A run is not a pass until its required job is completed with success and the evidence artifact supports the intended behavior. A skipped, queued, cancelled, or unrelated green run is not a pass.
5. **Accept the first verified fix, not the first green-looking run.** One branch passing the relevant test is sufficient to select a candidate. Verify its evidence and regression/syntax checks, then open a PR. Do not merge/deploy automatically merely because one experiment passes; use normal review/required checks and preserve the safe-main rule.
6. **If all experiments fail**, update the cause matrix from new evidence and create a second set of distinct hypotheses. Do not endlessly rerun the same unchanged test and call that multiple solutions.
7. **Lock only verified stable results.** Add a lock/guard only after the fix is merged and required checks plus relevant evidence are green. A lock must document what is protected, the verification run(s), and how an authorized change can be made. Do not lock a failing or unverified state.
8. **Report honestly.** Separate confirmed facts, likely causes, untested hypotheses, branch links, run links, artifact links, and remaining blockers. Never fabricate branches, runs, screenshots, or success.

## Required cause-matrix fields

| Field | Meaning |
|---|---|
| Symptom | Exact failing/skipped gate and step |
| Root cause | Confirmed underlying cause, or explicitly "not yet confirmed" |
| Candidate cause | One independent hypothesis |
| Evidence | Log/artifact/commit supporting it |
| Confidence | High / medium / low |
| Falsification test | Small test that can disprove the hypothesis |
| Branch | Isolated fix branch URL |
| Run | Exact Actions run URL and run ID |
| Result | Pass / fail / skipped / queued / not run |
| Decision | Keep / reject / investigate |

## Android WebView Real Chat QA initial investigation example

The observed failure included successful emulator boot, successful APK installation, app launch, and ADB forwarding, followed by failure around retrieval of the WebView DevTools `/json/list` target list. This narrows the investigation but does not by itself prove the root cause. Candidate areas to test independently include: (a) DevTools socket selection/availability, (b) endpoint readiness and HTTP response validation, (c) app WebView debugging/target URL mismatch, (d) app startup/page readiness timing, and (e) CDP target discovery or chat selector assumptions. Capture the actual response body and logcat before selecting a root cause.

## Acceptance criteria for this rule

- A documented cause matrix exists for each blocked QA gate.
- Candidate fixes are isolated in distinct branches.
- Each experiment has a real Actions URL/run ID, or is explicitly marked "not run" with the blocker.
- One verified, evidence-backed candidate is enough to proceed to PR review.
- Main/live remains untouched until review and required checks pass.
