# MOSHARROF Android Autonomous Agent — Owner Requirements

This document preserves the owner's six requested foundations. It is a target specification, not a claim that every capability is shipped.

## 1. Multimodal action planning and UI grounding
- Bengali-first voice and text commands.
- Prefer Accessibility node labels, content descriptions, and stable view IDs.
- Coordinate taps/swipes require a consented screen frame, a verified target region, screen-bound clamping, a layout-change stop, and a postcondition check.
- Appium/UiAutomator2 are for emulator/device end-to-end testing, not production permission bypass.
- Every action needs a typed plan, policy decision, timeout, postcondition, and cancel/stop path.

## 2. Accessibility and system hooks
- AccessibilityService is optional and must be enabled manually by the device owner in Android Settings.
- Node inspection, label clicks, and scrolling must reject password/PIN/OTP/payment/security-sensitive targets.
- Coordinate gestures require a separately reviewed bounded implementation, declared gesture capability, explicit task authorization, screen bounds checks, and post-action verification.
- Root, Magisk, LSPosed, ADB shell, Termux, and arbitrary Python/Bash execution are not baseline consumer capabilities. Any future developer-only profile must be opt-in and must not bypass authentication or platform security.

## 3. Offline local vision-language models
- Keep a provider-neutral inference interface.
- Phi-3 Vision, MobileVLM, or another model is only a candidate until Android runtime, memory, license, latency, and device compatibility are benchmarked.
- Offline OCR/vision requires a user-started MediaProjection consent session; do not upload screen images or accessibility trees by default.
- Model output is untrusted proposal data and must pass the same schema, policy, and permission gate as every other action.

## 4. Voice, interruption, and progress
- Reuse the existing microphone/STT and TTS/provider-fallback path.
- Long-running tasks expose visible status, elapsed time, cancel, and step-by-step progress.
- A new voice command can safely interrupt a running task; cancellation stops future actions and reports completed steps.
- Do not imply background work continues after Android stops the process.

## 5. Self-healing and privacy-safe memory
- Retry only bounded, idempotent actions. After a failed postcondition, re-inspect and create an alternate approved plan rather than blindly repeating taps.
- Self-healing does not mean modifying its own source code or installing executables automatically; it means selecting an approved alternative, reverting a reversible change, or asking for help.
- Memory is local-first, opt-in, inspectable, exportable, and deletable. Store preferences/task summaries, never passwords, PINs, OTPs, payment credentials, or full private screen contents.
- A vector/RAG store remains a future module until Android compatibility, encryption, backup, and deletion are tested.

## 6. Kotlin-oriented Android Studio target structure
The current APK wrapper generates Java MainActivity and Java Capacitor plugins. Keep this working baseline until Kotlin parity is built and tested. Target separable packages: app/ (lifecycle/consent/status); agent/domain/ (typed plans/results/capabilities/policy); agent/planner/ (Bengali intents/model interface); agent/policy/ (permissions/confirmation/budgets); agent/execution/ (step executor/timeouts/cancellation/postconditions); agent/accessibility/ (user-enabled service/filtered nodes/bounded gestures); agent/perception/ (MediaProjection/local OCR/optional VLM); agent/files/ (SAF/duplicate scan/review/undo); agent/memory/ (opt-in local summaries/retrieval); agent/voice/ (STT/TTS/interruption/provider failover); agent/diagnostics/ (evidence-backed checks/reversible repairs); agent/audit/ (minimal privacy-safe events).

Migrate one module at a time, preserve the Java/Capacitor bridge contract, and require APK build plus regression tests at every step.

## Current status
- Foundation present: Bengali planner, capability registry, user-mediated Settings intents, SAF file/folder operations, bounded exact-hash duplicate scan, label-based Accessibility inspection/click and scroll hooks, and CI contract tests.
- Partial/not physically verified: native plugin registration and generated APK integration, end-to-end file manager UI, Accessibility behavior across OEM devices, and task interruption/postcondition verification.
- Planned: Appium/UiAutomator2 harness, coordinate-based visual grounding, MediaProjection/OCR, offline VLM, local vector/RAG memory, reviewed photo/music organization, bounded self-healing, Kotlin module migration.
- Never automate credential harvesting, authentication bypass, or autonomous payment submission.
