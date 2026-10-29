# Jackbox Control Box

Jackbox is the opt-in lifecycle manager for optional Mosharrof organs. It builds on the existing `organs/<id>/` layout, generated organ registry, and contract-gated runtime.

## Adding a feature

1. Create `organs/<module-id>/` with the required `organ.json`, `index.js`, README, and tests files.
2. Declare each callable API in `organ.json`; the registry builder checks IDs and dependency contracts.
3. Add an entry to `core/jackbox/registry.json` with `id`, `path: "organs/<module-id>"`, `entry: "organs/<module-id>/index.js"`, and `enabled: false`.
4. The Pages preparation step validates the manifest and copies the module to the browser artifact. Do not add arbitrary import URLs.
5. Run module tests, architecture checks, the Pages browser runtime smoke test, and real chat regressions relevant to the change.
6. Enable only after review and evidence; keep the module disabled by default until then.

## Module contract

A Jackbox module exports:
- `organId`, exactly matching its registry/organ ID.
- `initialize(scopedRuntime)`, for startup work.
- `getHealth(scopedRuntime)` and `reportIssue(scopedRuntime, summary)`.
- `dispose(scopedRuntime)`, to release listeners/timers/resources before detaching.
- A function for every additional name declared in `organ.json.public_api`.

The control box checks the manifest and module contract, registers only declared APIs, and uses the runtime's enabled state to block calls to disabled modules. A failed attachment is quarantined and disabled; one module's attach failure does not prevent other modules from initializing.

## Control API

After the organ bootstrap succeeds, the host exposes `window.MosharrofEntitySystem.jackbox`:
- `list()` — module status and quarantine information.
- `enable(id)` — import and attach one explicitly registered module.
- `disable(id)` — call its `dispose()` hook and block future runtime calls.
- `initialize()` — initialize modules marked enabled in the manifest; disabled modules are not imported.

## Safety boundaries

- The module loader accepts validated kebab-case IDs and constructs the import path itself; registry URLs are never executed.
- Runtime calls to disabled source or target organs fail closed.
- Disabling a module cannot undo arbitrary external side effects if its `dispose()` implementation is incomplete. This is why disposal is required and tests must cover it.
- Browser-origin JavaScript is not a security sandbox against malicious code shipped in the same origin. Code review, CSP, CI, branch protection, and trusted deployments remain necessary.
- Hash locks prove exact file identity, not correctness. A lock is added only after evidence; intentional replacement uses a separate unlock PR, a reviewed change, fresh tests, and a separate re-lock PR.
