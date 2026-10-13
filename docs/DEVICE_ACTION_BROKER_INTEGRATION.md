# Device Action Broker — integration status

The catalog in PR #578 is a plan, not a claim that every Android capability exists.
This follow-up adds a reusable enforcement primitive at `src/core/device_action_broker.py`.

## Enforced by the broker
- Every invocation needs fresh approval bound to the exact action ID, capability, entity, and resource scope.
- Trusted authorization is re-checked after approval and immediately before execution.
- An explicit audit sink is mandatory; the broker verifies that a pre-execution audit write succeeds before allowing the operation to run.
- Missing context, denied authorization, exceptions, and blocked destructive capabilities fail closed.
- An operation is reported as `SUCCESS` only when the supplied independent verifier returns true.
- Verification failure is reported as `UNVERIFIED`; operation exceptions are `FAILED`.
- Audit events include minimal action metadata and only a boolean indicating that a scope was supplied; raw resource scopes, approval tokens, operation results, and exception messages are excluded.
- DELETE, destroy, wipe, format, purge, and factory-reset capability names are blocked independently of grants.

## Important integration boundary
This is not yet wired to every Android intent, overlay service, voice action, provider route, or UI control. Each adapter must call this broker with a trusted `authorize` function, a fresh `approval_check`, a narrowly scoped operation, and a real result verifier. The runtime must not advertise a capability as verified until its adapter and device/provider tests pass.

The broker does not add permissions to Android, bypass Android consent, or permit destructive actions. `DeviceActionBroker.from_permission_guard(...)` now connects the broker to `PermissionGuard.authorize_capability` and an `AuditLedger.record`-compatible sink while keeping tokens, raw scopes, arguments and results out of audit details. This adapter is covered by an integration test. Important: the repository's current `AuditLedger` stores records in process memory; that is not durable production audit storage. Before enabling real device actions, replace or back it with the approved durable audit store and verify its failure behavior. The broker now refuses to execute if the pre-execution audit write fails. The broker is still not connected to every Android intent, overlay, voice action, provider route or UI control, so this PR is not a claim of complete device-control rollout.
