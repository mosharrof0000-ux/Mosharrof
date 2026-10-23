# Jackbox Control Box Contract

## Relationship to the existing organ architecture

Mosharrof already uses one folder per feature under `organs/<organ-id>/`, with `organ.json`, `index.js`, documentation, and tests. Jackbox must build on that contract rather than inventing a second arbitrary file loader. The generated `web/runtime/organs.registry.json` remains the source of runtime API/dependency metadata.

## Module lifecycle

1. **Proposed** — a feature has its own organ folder and declares its APIs/dependencies.
2. **Validated** — the registry builder and architecture gate pass; its own tests and required consumer regression tests pass.
3. **Eligible** — a reviewed host adapter explicitly registers it in the Jackbox control manifest.
4. **Enabled** — a reviewed host adapter chooses to initialize it. Disabled is the default for any new module until integration and compatibility evidence exists.
5. **Quarantined** — failed health/compatibility checks make the host adapter stop routing new work to that module. Existing core behavior must remain available.
6. **Retired** — remove the registration in a separate reviewed change after consumers are checked.

## Security and compatibility rules

- No arbitrary URL, user-provided import string, `eval`, or dynamic script injection.
- No implicit filesystem, network, device, or credential capability.
- Calls across feature boundaries use declared public APIs and dependency contracts.
- Keep module files separate; respect the existing architecture line/link limits.
- A registry flag is not, by itself, a security boundary. The runtime/host must enforce enabled state for every invocation path.
- A module is not truly detached until all routing paths are gated and any resources it opened are cleaned up. The current runtime has no general unregister/dispose contract; therefore the initial registry is **declarative**, not a claim of live runtime enable/disable behavior.

## Runtime integration acceptance criteria

Before Jackbox controls production organs, a separate implementation must:
- Define a host adapter using the existing organ registry/runtime contracts.
- Gate every invocation path on module state.
- Support an explicit `dispose()` cleanup hook and quarantine on failed health checks.
- Test enabled, disabled, duplicate, unknown, incompatible, and failing modules.
- Prove a disabled or failing module cannot block the core/chat organ.
- Pass full browser chat round-trip and relevant Android real-chat QA before Live promotion.

Until then, add-on modules can be organized and reviewed separately, but no UI/runtime switch is represented as implemented.
