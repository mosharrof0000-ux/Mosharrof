# Jackbox Diagnostics Organ

An optional, disabled-by-default example module used to verify the Jackbox lifecycle.
It reports only local runtime health and a bounded request ID; it does not access network,
device APIs, credentials, or persistent storage.

## Lifecycle

- `initialize(runtime)` marks the module active.
- `getHealth(runtime)` returns the module's scoped runtime health and lifecycle flags.
- `reportIssue(runtime, summary)` reports a bounded runtime issue.
- `runSelfCheck(runtime, payload)` confirms the module is enabled and initialized.
- `dispose(runtime)` marks the module inactive.

Keep this module disabled in `core/jackbox/registry.json` by default. It exists to exercise
the actual browser import/attach/dispose path without changing core chat behavior.
