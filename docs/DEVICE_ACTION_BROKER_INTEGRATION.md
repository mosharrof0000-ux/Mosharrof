# Device Action Broker — integration status

The catalog in PR #578 is a plan, not a claim that every Android capability exists.
This follow-up adds a reusable enforcement primitive at `src/core/device_action_broker.py`.

## Enforced by the broker
- Every invocation needs fresh approval bound to the exact action ID, capability, entity, and resource scope.
- Trusted authorization is re-checked after approval and immediately before execution.
- Missing context, denied authorization, exceptions, and blocked destructive capabilities fail closed.
- An operation is reported as `SUCCESS` only when the supplied independent verifier returns true.
- Verification failure is reported as `UNVERIFIED`; operation exceptions are `FAILED`.
- Audit events include non-sensitive action metadata only; approval tokens, operation results, and exception messages are excluded.
- DELETE, destroy, wipe, format, purge, and factory-reset capability names are blocked independently of grants.

## Important integration boundary
This is not yet wired to every Android intent, overlay service, voice action, provider route, or UI control. Each adapter must call this broker with a trusted `authorize` function, a fresh `approval_check`, a narrowly scoped operation, and a real result verifier. The runtime must not advertise a capability as verified until its adapter and device/provider tests pass.

The broker does not add permissions to Android, bypass Android consent, or permit destructive actions. Audit persistence is supplied by the application via `audit_sink`; production wiring must use the project's approved audit store and define fail-closed behavior if that store is unavailable.
