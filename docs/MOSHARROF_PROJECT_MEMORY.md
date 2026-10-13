# MOSHARROF AI — Project Memory and Regression Ledger

**Last checked:** 2026-10-13  
**Repository:** https://github.com/mosharrof0000-ux/Mosharrof  
**Live Pages:** https://mosharrof0000-ux.github.io/Mosharrof/

## Source of truth

- GitHub `main` is the production source; the active Pages workflow is `.github/workflows/deploy-pages.yml`.
- The Pages workflow publishes **`./web`**, so `web/index.html` and its linked assets determine the live website. The repository-root `index.html` is not the Pages artifact entry point for this workflow.
- Never treat a draft PR, preview deployment, or Android APK as the live website.
- Record the exact commit SHA, PR, checks, deployment URL, and health-check result before declaring a change live.

## User-approved product contract

- Website and Android app should keep the same core design and interaction model. Android may add native full-screen/edge-to-edge behavior and native-only controls without changing the website's layout unexpectedly.
- Use the full available viewport; respect display cutouts and safe areas. Chat content scrolls beneath floating controls rather than reserving a large fixed header/footer.
- Keep the two round menu controls at the left and right. Avoid restoring a large centered brand/header layout unless the user explicitly asks.
- The top controls should have a restrained translucent/frosted-glass appearance, without a heavy border or opaque black slab. Dark mode stays black/dark; preserve the user's existing theme choice.
- Voice settings should be stable: speech speed, emotion/intensity, reading style, and selected voice/provider must not change silently between requests. Provide clear status until success/failure and explain provider fallback when observable.
- Keep the existing Gemini route intact while implementing fallback providers. Never expose API keys or tokens.

## Regression currently investigated (2026-10-13)

- Production Pages workflow uploads `./web`.
- The checked-in `web/index.html` did not load `web/edge-to-edge.css`.
- The stylesheet contained explicit `backdrop-filter:none !important` overrides for `.top`, so the intended frosted effect was disabled even if the stylesheet were loaded.
- This explains the source-level mismatch behind the missing glass header; it does not by itself prove the cause of every reported voice or website failure.
- A branch-only correction links the stylesheet with a cache-busting version and restores a restrained 18px frosted header. Regression tests guard the stylesheet link, full-viewport sizing, safe areas, and blur declarations.

## Memory versus runtime behavior

This file is durable **repository/project memory** and a record of approved requirements. It does not automatically give the running app cross-chat memory or the ability to repair itself.
The recent-turn continuity work and the safe self-repair roadmap must be considered active in production only after their PR dependency chain is reviewed, merged to `main`, deployed, and verified. At this check, PR #583 was still open/draft; therefore do not claim that persistent cross-chat memory or autonomous repair is live.

## Change-control rules

1. Inspect the live source, current `main` SHA, open PR dependencies, and failing checks before editing.
2. Work on a feature branch; never push a speculative fix directly to `main`.
3. Add regression tests and run CI; check the diff for unrelated changes.
4. Open a draft PR with the cause, exact files, checks, and rollback plan.
5. Do not merge, deploy, change secrets, or run destructive device actions without explicit user approval.
6. After approved deployment, verify the live Pages response and a real rendered screenshot; verify the Android APK separately on-device.
7. If any required check fails or the rendered result regresses, stop promotion and report the evidence. Keep a known-good recovery point.
