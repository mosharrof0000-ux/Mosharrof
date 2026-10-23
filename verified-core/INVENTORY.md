# Verified Core candidate inventory (initial pass)

**Snapshot inspected:** `main` at `6b332c53933a65ea3238e1cd45d0e1b4b2fe00c9` (2026-10-23).
**Repository tree:** 818 entries at inspection time.
**Status:** inventory only; none of these files is declared locked by this report.

## Candidate dependency map

| Area | Candidate paths | Why it matters | Minimum evidence before locking |
|---|---|---|---|
| Live entry / bootstrap | `index.html`, `web/runtime/organs.registry.json` | Public page entry and generated runtime registry can change startup behavior | Browser smoke, registry regeneration/diff check, desktop + mobile interaction QA |
| Organ registry | `core/organ-registry/index.js`, `scripts/mosharrof_registry.py` | Maps feature organs and validates module metadata | Registry unit tests, duplicate/invalid-path tests, generated output reproducibility |
| Shared runtime API | `core/organ-runtime/index.js`, `core/organ-runtime/scoped-api.js` | Shared APIs used by feature modules; changes can affect many organs | Runtime/service contract tests, compatibility tests for consumers |
| Persistent memory | `core/organ-runtime/persistent-memory.js` | Persistent state and memory behavior may affect sessions and user data | Persistence, migration, isolation, and failure-recovery tests |
| Core/chat/AI organs | `organs/core/`, `organs/chat/`, `organs/ai/` | Primary UI and assistant request paths | Organ-local tests plus full chat round-trip; no mock-only acceptance |
| Architecture guard | `scripts/mosharrof_architecture_gate.py`, `.github/workflows/architecture-gate.yml` | Enforces separation, size/link caps, and architecture rules | Gate's negative tests prove invalid changes fail; positive tests prove valid modules pass |
| Browser/Pages promotion | `.github/workflows/deploy-pages.yml` | A workflow change can affect Live publication | Inspect event/condition guards; preview + health checks; confirm failed verification blocks promotion |
| Android real-chat QA | `.github/workflows/android-apk-webview-real-chat-qa.yml` | Distinguishes APK/WebView/backend behavior from screenshot-only success | ADB/emulator startup, installed APK, non-mock assistant response first, then screenshot validation |

## Risk notes / likely failure points

1. **Shared runtime dependency fan-out:** changing `core/organ-runtime/*` or the registry may affect many organs; don't lock these based on a syntax check alone.
2. **Generated file drift:** `web/runtime/organs.registry.json` should be generated from its source and checked for a clean diff, not edited independently without a reason.
3. **Promotion guard risk:** changes to deployment workflows must be reviewed separately; a green unit test does not prove Live deployment safety.
4. **Real chat vs screenshot ordering:** a screenshot is evidence of pixels only. Record the chat round-trip outcome first; accept success only with a real assistant answer, then validate screenshot bytes.
5. **Repository settings are part of enforcement:** current branch metadata reports `main` as protected but required status-check enforcement is disabled. The new workflow cannot force GitHub to block a merge until a required check/ruleset is configured in repository settings.

## Locking procedure

For each proposed file:
1. Record its callers/importers, configuration, generated inputs/outputs, and external services.
2. Run its focused tests, dependent-organ tests, and relevant end-to-end/regression checks.
3. Record the exact tested commit, test run URLs, known limits, and SHA-256 of the accepted bytes.
4. Add one manifest entry in a reviewed change; re-run the lock gate.
5. Verify that a separate PR changing the locked file fails the gate.
6. Only then mark it `locked`. If any required evidence is missing or inconclusive, leave it a candidate.

## Jackbox boundary

Jackbox modules live separately under `jackbox/modules/<id>/` and register through `jackbox/registry.json`. The registry currently contains no modules and the first version does not execute code. The runtime adapter/API must be designed and reviewed as its own change before modules can call core functionality. New modules remain disabled until their compatibility and security tests pass.
