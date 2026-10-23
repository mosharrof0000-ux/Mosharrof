# Action Contribution Module

This core module binds feature actions to the existing per-message `message-actions` group. It does not create a parallel toolbar and does not replace current button handlers.

## Runtime path

- Source: `core/action-contributions/`
- Browser artifact: `web/runtime/core/action-contributions/`
- Packaging: `scripts/prepare_web_organ_runtime.py`
- Bootstrap: `web/sidebar-recovery.js`
- UI contract: `manifest.json`

The runtime annotates the existing read-aloud, feedback, edit, copy, retry, and share controls with module/group identifiers. A mutation observer applies the same mapping to messages rendered later.

## Registering a new action

A module may call `window.MOSHARROF_ACTION_CONTRIBUTIONS.register(contribution, handlers)` only after the registry reports `status: "ready"`. The contribution must use an existing registered group and declare both `manual` and `automatic` modes, a non-empty `automatic_policy_id`, and `automatic_ready: true`. The handler contract requires:

- `manual(context)`
- `automatic(context)`
- `authorizeAutomatic(context)`, which must return exactly `true`
- `verify(result, context)`, which must return exactly `true`

The runtime adds one button to each existing message action group. A tap calls the manual handler and records its verification status on the button. Automatic work is never scheduled by this module; an authorized orchestrator must explicitly call `runAutomatic(id, context)`. Missing handlers, policy, authorization, or successful verification fail closed.

## Current limits

Existing controls remain manual and are marked `data-automatic-ready="false"` with a reason. This module is an integration/registration layer, not the complete background job queue, durable checkpoint system, voice provider implementation, or deployment controller.

## Validation

- `python scripts/validate_action_contributions.py`
- `python -m unittest discover -s tests/ui -p 'test_*.py' -v`
- `python scripts/prepare_web_organ_runtime.py`
- `python scripts/test_action_contribution_browser.py` after installing Playwright Chromium and serving `web/` locally

## Promotion gate

A successful static/browser registry test does not substitute for the APK WebView real-chat workflow. A cancelled or not-started Android QA run is not a pass; keep the PR unmerged until that workflow completes successfully or an authorized reviewer explicitly waives the device-level check.
