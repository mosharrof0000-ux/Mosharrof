# Android Agent Architecture

## Modules and responsibilities

```
Voice / Chat UI
   -> Input Gateway (speech-to-text, text commands, interruption)
   -> Task Planner (typed, bounded action plan)
   -> Policy Gate (package allowlist, risk, confirmation, timeout)
   -> Action Router
       -> Accessibility adapter (semantic node actions)
       -> UiAutomator2/Appium adapter (test/debug builds)
       -> Visual grounding adapter (coordinates only as last resort)
   -> Postcondition verifier -> Recovery planner -> User-visible result
   -> Opt-in local memory (encrypted preferences + local retrieval index)
```

### Suggested Kotlin package layout

- `app/`: application entry point and UI
- `accessibility/`: Android AccessibilityService, bounded node snapshots
- `planner/`: intent normalization and typed plans; no direct Android calls
- `policy/`: risk classification, consent, package allowlist and action budgets
- `execution/`: action interfaces, timeouts, cancellation and postcondition checks
- `vision/`: screenshot preprocessing, on-device model interface and coordinate mapping
- `voice/`: SpeechRecognizer/AudioRecord, TextToSpeech, interruption handling
- `memory/`: opt-in encrypted preferences and local retrieval
- `testing/`: fake adapters, instrumentation tests and device test scenarios

## Action contract

Represent each proposed operation as a typed action (open app, tap semantic node, swipe, toggle setting, inspect selected files). Every action must have a deadline, retry budget, expected postcondition, target package, and risk class. Fail closed when the target is ambiguous. Do not let an LLM generate arbitrary shell strings.

Use semantic Accessibility node IDs/text/content descriptions before image coordinates. Coordinates are fragile across display sizes, font scaling, overlays and UI updates; use them only after checking screenshot dimensions and revalidating the target immediately before the gesture.

## Permissions and execution boundaries

- Accessibility: user must enable it in system settings; clearly disclose what is read.
- Microphone: request at point of use and show listening/recording state.
- Files: use Storage Access Framework / scoped storage; avoid broad file access unless justified.
- App launch: use package intents and visible status.
- System settings: use supported Settings intents; do not silently alter secure settings.
- Root and in-app shell execution are excluded. An optional Device Admin receiver/ADB Device Owner provisioning path is available for owner-managed test devices; provisioning requires a trusted external ADB host and Android may require a freshly provisioned device. No remote arbitrary shell commands are executed.

## Self-healing

1. Capture bounded current UI snapshot.
2. Match stable semantics (resource ID, content description, visible text, role, bounds).
3. If target missing, re-plan from observed state with a small retry budget.
4. Require confirmation if the new plan changes risk or external side effects.
5. Verify the expected postcondition.
6. Stop and explain if still uncertain; never mutate app code or bypass permissions at runtime.

## Local models and memory

Expose a `ScreenUnderstanding` interface so an on-device vision model can be swapped without coupling it to execution. Benchmark memory, latency, accuracy and thermal behavior on target devices before selecting a model; Phi-3 Vision may be too large for some phones. Keep model assets separately versioned and never download executable code as model data.

Memory is opt-in, local-first, deletable, and excludes secrets. Store user preferences and task summaries rather than complete screenshots or full screen text. Retrieval results are context, not executable instructions.

## Test and release gates

- Unit: plan parsing, policy gate, risk classification, retry budgets and redaction
- Instrumentation: service lifecycle and node traversal
- UI tests: Appium/UiAutomator2 against a dedicated emulator/device
- Static checks: duplicate-file scan, manifest permission review, secret scan
- Build: debug APK on pull requests; signed release only from protected release workflow
- Promotion: all required checks green; no direct push to main; manual device acceptance before claiming production-ready
