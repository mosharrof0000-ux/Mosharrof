# Trusted Permission Context Service

## Why this layer exists

The Universal Permission Engine requires grants, scope, policy, provider
readiness and approval decisions. Those values must not be trusted merely
because a requesting module supplies them. `TrustedPermissionService` exposes
a narrower API that accepts the requested capability, entity ID, resource
scope and an optional approval token only.

## Trusted resolvers

The host application must inject server-owned resolvers for:
- grants assigned to an entity;
- the entity's authorized scope;
- policy evaluation against the current policy store;
- provider readiness based on server configuration;
- verification of an approval token against an authenticated approval record.

If a resolver is missing, raises an exception, or returns a false decision, the
request is denied. The service does not interpret a capability catalogue entry
as a grant.

## PermissionGuard adapter

`PermissionGuard.authorize_capability(...)` now delegates to this trusted
service when explicitly configured. If it is not configured, the capability
authorization method returns `DENIED`. The existing legacy `check()` API
remains unchanged for backward compatibility. Security-sensitive code must
call `authorize_capability()` and must not treat the legacy method as a
substitute for trusted grant/policy evaluation.

## Remaining production boundary

This adapter is **not yet wired into existing API routes or production grant,
policy, provider, and approval stores**. Its presence alone does not enforce
authorization across the application. The next integration must be a separate
change with route-by-route inventory, trusted server-side stores, compatibility
tests, route coverage and a rollback path. Never pass resolver callbacks from
untrusted clients.


## Core runtime entry point

`MosharrofCoreBrain.authorize_capability_action(...)` is an explicit runtime
entry point for trusted capability authorization. It delegates to
`PermissionGuard.authorize_capability()` and records both allowed and denied
decisions in the runtime memory ledger and audit ledger. Approval tokens are
not included in audit details. If the core is created without a configured
trusted service, capability authorization is denied.

This entry point does not automatically replace the older operation-level
`authorize_action()` flow or secure every tool/API route. Existing callers must
be migrated deliberately after call-site inventory and compatibility testing.
The in-memory audit ledger is not durable across process restarts.


## Dynamic tool factory

The dynamic `ToolFactory` now requires trusted authorization for both
`ai.tool.register` and `ai.tool.execute`, with explicit approval-token
verification. The default, unconfigured service denies both actions. Existing
tool files are no longer imported during factory startup because importing a
module can execute code before authorization; a tool is loaded only after its
execution capability passes. The AST checks remain defense-in-depth, not a
sandbox for arbitrary Python. Do not enable untrusted dynamic code in a
production process without a stronger isolation boundary.
