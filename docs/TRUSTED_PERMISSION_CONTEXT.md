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

## Current boundary

This service is an isolated authorization facade with unit tests. It is **not
yet wired into existing API routes, PermissionGuard, or production grant
storage**, and its presence alone does not enforce authorization across the
application. Integration must be a separate change with compatibility tests,
route-by-route coverage and a rollback path. Never pass resolver callbacks
from untrusted clients.
