# Android Control Plugin Bridge

## Purpose

Keep Android device control as an independently testable native capability. MOSHARROF AI can later connect through a plugin adapter without embedding device-control logic in the web/PWA or granting the AI server direct device access.

## Current implementation in this branch

- `integration/AndroidControlPlugin.kt`: provider-neutral Kotlin contract and typed, bounded action vocabulary.
- `integration/PluginCommandGate.kt`: deterministic local validation and confirmation gate.
- `PluginCommandGateTest.kt`: tests for confirmation binding, malformed input, risky labels and unexpected parameters.

This is an integration boundary, not yet a connected network service. No server URL, API key, token, socket, or background listener is introduced.

## Request flow

1. MOSHARROF AI (future adapter) sends a typed intent through an authenticated transport.
2. The Android app validates request size, action type, target and required fields locally.
3. The app shows the proposed action to the device owner.
4. The device owner approves in the Android app's own UI. A remote response cannot manufacture this local approval.
5. The local policy and permission checks run again immediately before execution.
6. The existing Android adapter performs one bounded action.
7. The executor verifies the result and returns a redacted status; uncertain outcomes fail closed.

## Initial supported action vocabulary

- Open an installed app by resolved app label.
- Inspect the current screen only when explicitly requested.
- Navigate Back.
- Tap one exact, unambiguous label in a supported app.
- Perform one directional swipe in a supported app.

The gate does not permit arbitrary shell commands, arbitrary coordinates, unrestricted text entry, background screen capture, or destructive/external actions. Risky exact labels (send, submit, delete, pay, purchase, install, uninstall, share, post, confirm, transfer) are rejected in this initial bridge. Any local executor must additionally verify package allowlists, Android permissions, current screen state, and postconditions; passing this gate alone is not execution authorization.

## Versioning and future standalone repository

Keep this directory isolated from the web/PWA. The current GitHub connector cannot create a new repository, so the implementation is being developed on an isolated feature branch in the existing repository rather than pretending a separate repository has already been created. When a dedicated repository is provisioned, move the native Android module and its tests there without changing the Live Pages deployment. MOSHARROF integration should then be a versioned plugin adapter, not a dependency from the web frontend into Android internals.

## Required gates before activation

- Unit tests and debug APK build pass on the exact PR head.
- Emulator instrumentation tests pass.
- Physical-device acceptance verifies consent, overlay behavior, task cancellation and OEM compatibility.
- Transport authentication, replay protection, request expiry, rate limiting and explicit pairing are implemented before any remote adapter is enabled.
- Release signing and install/upgrade validation are completed.
- The existing MOSHARROF main/Live deployment remains untouched until a separate reviewed integration PR is approved.
