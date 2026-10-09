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
