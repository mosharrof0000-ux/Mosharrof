# Mosharrof AI Ecosystem — Master Blueprint

**Status:** Implementation plan; not a claim that every listed capability is already live.  
**Primary language:** Bengali-first, with English where an API, code symbol, or provider requires it.  
**Repository:** `mosharrof0000-ux/Mosharrof`  
**Live web app:** https://mosharrof0000-ux.github.io/Mosharrof/

## 1. Mission

Build a permission-controlled assistant that accepts Bengali voice/text requests and coordinates device assistance, research, image/video/audio creation, and authorized social publishing. Prefer existing working modules and free tiers first. Keep provider-specific code behind adapters so Gemini and existing voice features remain available.

**Operating principle:** Create → Review → Approve → Store → Backup → Document → Test → PR → Deploy → Health-check.

## 2. Current foundation and honest capability boundary

Existing repository foundations include:

- Entity/model registries and policy/permission configuration.
- Universal permission engine: `src/core/universal_permission_engine.py`.
- Autonomous issue-command and scheduled workflows under `.github/workflows/`.
- Voice-processing foundation: `src/core/voice_engine.py`.
- Web device-layout classification: `web/app-builder/device-engine.js`.
- CI, verification, visual QA, Android APK build, Pages deployment, and recovery workflows.

These foundations do **not**, by themselves, prove that Android apps can be installed/uninstalled remotely, that a real video/music provider is configured, or that social accounts can publish automatically. Each capability must have a working adapter, valid user-granted permissions, tests, and a verified end-to-end result.

## 3. Execution modules

### A. Command intake and task coordinator
- Normalize Bengali voice/text requests into a structured task.
- Resolve intent, required module, inputs, output destination, estimated provider/cost limits, and approval level.
- Track task states: `received → planned → awaiting_approval (if needed) → running → succeeded/failed → audited`.
- Return honest progress and failure reasons; never report success before the provider confirms it.

### B. Permission, safety, and audit layer
- Route every action through the existing permission engine and policy files; do not create a competing permission system.
- Deny unknown capabilities, scope escape, secret exposure, and destructive actions.
- Require explicit confirmation for consequential actions such as uninstalling an app, clearing user data, granting account access, or publishing content.
- Use least privilege, short-lived credentials where possible, redacted logs, bounded retries, and an audit trail.
- Do not store passwords, API tokens, OAuth refresh tokens, or private keys in chat, source files, or ordinary project memory.

### C. Android device assistant
- Separate web-app assistance from actual operating-system control.
- First deliver safe read-only diagnostics and guided actions.
- For real device actions, build a separately permissioned Android companion/bridge where Android APIs allow it. Show the exact action and scope before requesting system permissions.
- App installation/uninstallation, clearing other apps' data, background RAM flushing, and system-level changes are restricted by Android permissions/policies; do not promise unsupported silent control. Never bypass OS protections.
- Cache cleanup must target only app-owned or explicitly selected cache; never silently clear personal data.

### D. Image, video, and audio creation
- Define provider-neutral interfaces for image, video, music/audio, and text/script generation.
- Start with available free/no-card options and clearly label quota, watermark, duration, quality, latency, and license limits.
- Preserve existing Gemini chat/TTS behavior. A new provider must be isolated behind an adapter and tested before becoming a fallback.
- Support aspect-ratio presets: 9:16 vertical for Shorts/Reels/TikTok; 16:9 horizontal for YouTube/Facebook; allow user overrides.
- For Baul/folk audio, create original lyrics/prompts and verify usage rights; do not imitate a living artist's voice without authorization.
- Store job metadata and resulting artifact references, not secrets. Failed/over-quota providers should fall back only to configured, authorized alternatives.

### E. Social publishing and scheduling
- Create separate adapters for YouTube, Facebook/Instagram, and TikTok; verify current official API access and account eligibility for each platform.
- Use official OAuth/API scopes only. Tokens belong in an approved secret store and must never appear in logs or prompts.
- Prepare platform-specific title, description, hashtags, thumbnail/caption, format checks, and a preview.
- Default flow: draft → user review/approval → schedule/publish → verify remote post ID/status → record audit result.
- Auto-publishing can be enabled only per account/platform after the user explicitly authorizes that scope. Respect platform rate limits, music/copyright rules, community guidelines, and scheduling limits.
- Do not claim a platform is connected until an authenticated test and a permitted read/write check succeed.

### F. Persistent project memory and records
- Keep durable project decisions in version-controlled docs and structured configuration, not in assumptions about ChatGPT memory.
- Maintain task state, provider readiness, approval records, artifact links, deployment SHA, and health-check results in an appropriate store with retention controls.
- Provide export, correction, and deletion controls for user data where supported; never persist secrets as project memory.
- ChatGPT/Gemini memory can help preserve preferences, but it is not the operational database and cannot execute a background job by itself.

## 4. Phased delivery sequence

### Phase 0 — Baseline and recovery (first)
1. Verify main commit, working tree state via GitHub, open PRs, current CI, deployment, and health checks.
2. Record a known-good recovery reference before feature work.
3. Inventory existing code/config for each requested capability; classify as implemented, partial, stub, or absent.
4. Keep all work on a feature branch; use PRs and required checks. Do not edit live main directly.

**Exit criteria:** baseline report and recovery reference documented; no unsupported claims about live capabilities.

### Phase 1 — Master task/permission contract
1. Define task schema, state machine, capability map, approval requirements, audit fields, and provider readiness.
2. Add unit tests for denied, approved, expired, missing-provider, and scope-escape paths.
3. Connect the command intake to the shared permission engine without bypasses.

**Exit criteria:** deterministic authorization tests pass; denied tasks do not invoke providers.

### Phase 2 — Media jobs
1. Add provider interface and readiness/health checks.
2. Integrate one verified free/no-card provider at a time.
3. Add job progress, timeout, retry, quota fallback, artifact storage, and 9:16/16:9 presets.
4. Validate actual generated outputs end to end.

**Exit criteria:** successful real provider job and deliberate failure/quota tests; existing Gemini/voice flows regressions absent.

### Phase 3 — Social account connections
1. Confirm each platform's current API eligibility and required app review.
2. Implement OAuth consent and least-privilege scopes per platform.
3. Implement draft preview, scheduling, publish, remote-status verification, and token revocation.
4. Begin with draft-only mode; enable publishing only after explicit per-platform approval.

**Exit criteria:** a permitted test action succeeds on each connected platform; no secrets in logs; scheduling survives restart.

### Phase 4 — Android companion
1. Specify the companion app and secure bridge protocol.
2. Implement read-only device/app diagnostics first.
3. Add only Android-supported actions with runtime permissions and confirmation screens.
4. Test denial, revoked permission, offline device, and unsupported-action paths.

**Exit criteria:** actions are limited to documented OS capabilities and user-approved scopes; no silent destructive actions.

### Phase 5 — Operations and gradual autonomy
1. Show task queue, provider health, approvals, retries, and audit history.
2. Enable scheduled jobs with rate limits, budgets, kill switch, and duplicate-job protection.
3. Add backup/restore and deployment health verification.
4. Increase autonomy only after reliability data supports it.

**Exit criteria:** repeatable end-to-end tests, rollback path, health checks, and auditable outcomes.

## 5. Delivery and recovery rules

- One scoped change per PR where practical.
- Do not merge while required checks are failing, pending, or unstable.
- Do not treat a successful CI run as proof that a live external provider/account is connected.
- Verify the deployed commit and a real health/readiness check after deployment.
- Keep a known-good commit/recovery path; never overwrite or discard working state without review.
- If a check fails, inspect its logs and fix the cause before promotion.
- Report exact status: `implemented`, `tests passed`, `deployed`, and `live verified` are distinct states.

## 6. User interaction rules

- Communicate in Bengali by default.
- Prefer automatic execution for safe, reversible work that the connected tools genuinely support.
- Ask one clear confirmation before high-impact or externally visible actions.
- When user action is unavoidable (OAuth consent, Android permission, platform app review, secret creation), explain exactly why and give the shortest safe steps.
- Never ask the user to paste a secret/token into chat. Ask them to save it directly in the provider's or repository's secure settings.
- On “পরের ধাপে যাও”, continue from the latest verified project state rather than restarting or guessing.

## 7. Initial implementation backlog

1. Finish checking the currently open timer UI PR/deployment state before touching unrelated UI.
2. Produce a code-backed capability inventory for command intake, permission engine, media providers, social publishing, and Android control.
3. Build Phase 1 task/permission contract and tests.
4. Proceed to one real media-provider integration.
5. Add platform publishing adapters only after official API/OAuth requirements are verified.
6. Develop Android companion capabilities as a separate permissioned deliverable.

This blueprint is a roadmap and governance contract, not a statement that all modules are already implemented or connected.
