# MOSHARROF AI Creative Studio Roadmap

**Status:** planning-only; no production code or Live configuration changed.  
**Baseline checked:** `main` at `ca81b272e21e6dc66df6192f00ec3a3b233ffd81` (2026-10-15).  
**Working branch:** `docs/creative-ai-studio-roadmap-20261015`.

## User-selected outcomes

1. **One-command Short video:** Bengali or English prompt → outline/storyboard → generated draft → editable timeline → export.
2. **Image-to-video:** upload/select an image, describe movement and mood, generate a short clip, then edit it.
3. **Reusable templates:** save style presets for aspect ratio, fonts, colors, title position, subtitles, transitions, music, and export settings.
4. **Automatic work memory:** remember project decisions, template preferences, task status, errors, evidence, and next steps—with user controls to inspect, correct, export, and forget.
5. **Permission-based automation:** plan first; request narrowly scoped approval before any consequential action; record outcomes; never bypass protected branches or deploy without release gates.
6. **AI technology monitor:** read approved official/public sources, record links and dates, label unverified claims, identify gaps, and produce reports—not autonomous code changes.

## Repository audit (2026-10-15)

- Default branch is `main`; current main commit is `ca81b272e21e6dc66df6192f00ec3a3b233ffd81`.
- PR [#597 — one-command 10-second AI video generation](https://github.com/mosharrof0000-ux/Mosharrof/pull/597) is open and unmerged. It proposes server-side fal.ai Wan 2.7 text-to-video, with a server-side `FAL_KEY` secret, queue status, preview, and save links. A real provider smoke test still needs a configured key and confirmed credits/billing.
- PR [#588 — organ isolation and continuous-learning foundations](https://github.com/mosharrof0000-ux/Mosharrof/pull/588) is Draft/open/unmerged. Its proposal includes in-memory preference memory and a read-only public-feed scanner; durable memory and the scheduled monitor are not yet established as working production features.
- The roadmap PR's own test run [38768980729](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/38768980729) failed: **177 passed, 1 failed**. The failing test `test_provider_adapter_contract_stores_encrypted_secret_and_metadata` uses the fixed expiry `2026-10-15T00:00:00Z`, which was already in the past at run time; the vault correctly rejected it. This is an existing test-fixture issue unrelated to the documentation-only change, and it must be corrected in a separate code/test PR before treating the full suite as green.
- Latest observed scheduled run for the main-branch autonomous engine failed: [run 38767893552](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/38767893552). Diagnose this existing failure before adding another overlapping scheduler.
- PR [#597 check summary](https://github.com/mosharrof0000-ux/Mosharrof/commit/0af849bddf7c651fd4f2f173b753d7d8798c7e19/check-runs) showed 15 check runs in total; the observed `Verify before promotion` check succeeded and the deploy job was skipped. This is not proof of a production deployment or a successful real video generation.
- Existing documentation already describes permission gates and the autonomous system. Reuse those contracts instead of creating a second permission or scheduler system.

## Design continuity contract — mandatory for every phase

- **The existing MOSHARROF AI UI is the product shell.** Extend its current component hierarchy, spacing, typography, blue/violet/cyan palette, paired round controls, navigation, and responsive behavior; do not create a parallel app or a disconnected visual group.
- Before touching UI, inspect the current implementation and identify the existing component/organ that owns the relevant surface. Add the feature inside that owner or an established child component, using existing shared tokens and controls.
- Prefer small, reversible changes to the current layout. New video, image, template, memory, automation, and monitor experiences must open within the existing app shell and follow its navigation/action patterns.
- Do not introduce a new design system, duplicate header/sidebar, standalone floating panel, unrelated color palette, heavy glass effects, or extra always-visible controls unless the user explicitly approves a design change.
- Add visual regression checks at Android-sized and desktop viewports. Verify no layout overflow, no unexpected header/menu movement, and no changes to existing chat/Gemini behavior.
- If the correct existing component or design token is unclear, stop and inspect first rather than inventing a new group.

## Phased implementation

### Phase 0 — Preserve and baseline (required before feature work)
- Keep `main`, the live Pages app, Cloudflare Worker configuration, and Gemini chat/TTS paths unchanged.
- Record the current main SHA, health responses, required checks, and a known-good recovery target.
- Diagnose the failed scheduled autonomous-engine run and establish which checks are mandatory.
- Review PR #597 and #588 for overlap before adding new implementation. Do not merge either automatically.

**Exit gate:** baseline/recovery evidence captured; Gemini chat and TTS regression checks pass.

### Phase 1 — One-command Short video (reuse existing work)
- Review PR #597 against current `main`; validate Bengali prompts, 9:16 vs 16:9 selection, queue polling, timeouts, retries, cancellation, errors, and download behavior.
- Add a cost/credits disclosure and require explicit user confirmation before a provider request that may incur charges.
- Keep provider keys server-side; never return secrets to the browser or logs.
- Run tests without a paid call first. Run a real smoke test only after the user confirms provider credentials/credits are configured.

**Exit gate:** CI and Worker syntax/contracts pass; Gemini chat/TTS regression tests pass; live deploy remains skipped until approval.

### Phase 2 — Image-to-video
- Add a separate server-side route using the provider's image-to-video capability; do not expose `FAL_KEY` client-side.
- Accept only validated image uploads or explicitly supported, bounded input URLs. Enforce MIME/type and byte limits; protect against SSRF, unsafe redirects, oversized media, and unexpected provider responses.
- Offer motion prompt, duration, aspect ratio, resolution, optional end frame/audio where supported, queue progress, preview, and save.
- Record provider/model, request ID, timestamps, and user-visible cost/credit disclosure without logging secret values or unnecessary personal data.

**Exit gate:** unit/contract tests cover invalid image, bad URL, oversized input, provider timeout/failure, missing key, queue completion, and no-secret leakage. Real smoke test is approval-gated.

### Phase 3 — Template library and editor workflow
- Define versioned, JSON-schema-validated templates: platform/aspect ratio, clip order, title/subtitle style, Bengali font choice, colors, transition, music/voice settings, and export preset.
- Include starter presets for YouTube Shorts, Facebook Reels, quote/poetry, devotional/folk music, product showcase, and image slideshow.
- Make edits non-destructive: keep original media and template; store edits as a project recipe; show a preview before export.
- Begin with a safe editor foundation (trim/reorder/captions/title/music). Add advanced timeline effects only after the basic path is stable.

**Exit gate:** template round-trip tests; unsupported fonts fall back safely; media stays local or uses an approved storage path; export settings match selected aspect ratio.

### Phase 4 — User-controlled work memory
- Start with project-scoped records: explicit preferences, selected template, decisions, completed/failed tasks, evidence links, unresolved blockers, and next action.
- Explicit user corrections override inferred preferences. Do not infer or store sensitive traits.
- Add inspect/edit/delete/export controls, retention limits, provenance, and a clear distinction between durable user-approved memory and temporary runtime state.
- Never store API keys, tokens, raw credentials, or private media in memory records.

**Exit gate:** persistence/restart tests, per-user/project isolation, delete/forget tests, retention tests, and secret-scanning tests.

### Phase 5 — Permission-based automation
- Each action declares scope, risk, required permission, expiration, rollback strategy, and audit event.
- Show a proposed plan and expected side effects before asking approval.
- Require separate explicit approval for paid provider usage, external publishing, credential changes, destructive file actions, and production deployment.
- Deny by default if permission context is missing, stale, too broad, or unverifiable. Do not let an agent grant itself new permissions.
- Keep code changes in feature branches and PRs; deployment requires all release gates and the user's approval policy.

**Exit gate:** allow/deny matrix tests, stale/expired approval tests, duplicate-action/idempotency tests, audit evidence, and rollback drill.

### Phase 6 — AI technology monitor
- Reuse the monitor proposed in PR #588 after review; do not add a duplicate scheduler.
- Prefer official provider changelogs/docs and repository release feeds. Verify each source's current URL and hostname before enabling it.
- Produce dated reports: change summary, source URL, affected feature, confidence, free/paid status when verified, compatibility risks, and suggested next experiment.
- Keep Gemini, OpenAI, xAI/Grok, Google, and open-source model coverage as explicit coverage states; never claim a feed or model was tested when it was not.
- Monitoring may propose a change, but it cannot edit production code, access secrets, open/merge a PR, or deploy autonomously.

**Exit gate:** feed parsing and hostile-redirect tests, provenance checks, duplicate-item tests, source-gap reporting, and a read-only workflow run.

## Required cross-cutting tests

- Existing full CI, registry/architecture checks, security scans, Worker syntax, Pages entrypoint/preview, and Android build checks as applicable.
- Gemini chat and TTS regression tests before and after each relevant change.
- Permission-denial tests and secret-leak checks.
- UI smoke tests on Android-sized viewports; verify generated video preview, progress/error states, download links, keyboard/accessibility labels, and no horizontal overflow.
- Failure injection for network timeout, quota exhaustion, invalid provider response, missing secrets, and user cancellation.
- Record current-head run URLs and SHA in the PR. Do not count old-head green checks as evidence for a new commit.

## Release and safety policy

- This roadmap PR is documentation-only.
- No changes to `main`, live Pages, Worker secrets/configuration, Gemini integration, or provider billing have been made by this planning change.
- No paid provider request is authorized by this roadmap. The user must explicitly approve any real paid smoke test.
- Promotion rule: **Create → Review → Test → Approve → Backup → Merge → Deploy → Health-check → Report**.
- If a required check fails or a live regression is detected, stop promotion and follow the recovery runbook.

## External technical references

- [fal.ai Wan 2.7 text-to-video API](https://fal.ai/models/fal-ai/wan/v2.7/text-to-video/api)
- [fal.ai Wan 2.7 image-to-video API](https://fal.ai/models/fal-ai/wan/v2.7/image-to-video/api)
- [CapCut AI image-to-video workflow](https://www.capcut.com/features/ai-image-to-video-generator)

These links establish available product/API capabilities, not a guarantee that usage is free or that the current repository integration is deployed.
