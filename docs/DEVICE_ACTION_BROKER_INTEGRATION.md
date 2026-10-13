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
The APK workflow now generates a Capacitor Android bridge for a limited, explicit set of intents: open supported Settings pages, read public storage/RAM metrics, open the dialer (never place a call), open SMS/email drafts (never send), launch a package visible under a narrow Android `<queries>` allowlist, and open the system file picker (return URI only). The chat UI asks for approval, and the native Android bridge independently asks again immediately before each action. The native bridge writes minimal metadata to an app-private JSONL audit file and refuses to begin if the pre-action audit write fails. This local file is not tamper-proof and can be removed if app data is cleared.

The Python `DeviceActionBroker` remains a separate backend enforcement primitive; the current static PWA/native bridge does not call the Python `PermissionGuard` directly. Its own native confirmation and app-private audit gate protect the implemented intent subset, but this is not equivalent to a server-owned grant/policy engine. The Python `SQLiteAuditLedger` is a separate durable, append-only database implementation with sensitive-detail allowlisting and SQL update/delete triggers; it is tested but not yet the global runtime ledger for all subsystems. This PR does not claim that every catalog capability is implemented. Overlay service, Quick Settings tile, contact lookup, camera capture, screen capture, location, reminders, Bluetooth transfer, file content reading/export, repository changes, and general automation remain unimplemented or platform-gated.
