# MOSHARROF Permission & Token Provisioning Engine

This is an isolated project boundary for provisioning, validating, leasing, rotating, and revoking provider credentials for MOSHARROF AI. It must not be imported into browser code and must not share its secret store with the public frontend.

## Non-negotiable security contract

1. **Deny by default.** Unknown provider, capability, resource, permission, or operation is denied.
2. **Approval before every privileged action.** Token creation, permission changes, secret-store writes, rotation, revocation, deletion, and provider-side mutations require a valid, unexpired owner approval bound to the exact action, provider, scope, and environment. A standing policy may authorize routine *read-only credential selection and health checks* only within its explicit scope; it cannot authorize new privileges or destructive actions.
3. **No privilege escalation.** Never broaden a token to make a request succeed. If no credential covers the request, return `approval_required` or `unsupported`.
4. **Provider authorization is authoritative.** Provisioning is possible only when the provider supports it and a separately secured bootstrap identity has the exact token-management rights required. Never attempt to bypass provider controls.
5. **Least privilege and short lifetime.** Request the narrowest permission set and shortest supported TTL. Prefer provider-managed workload identity/OIDC when available.
6. **Secrets never leave the vault boundary.** No token values in source control, browser payloads, logs, issue comments, PRs, test fixtures, or audit records.
7. **Deletion is never autonomous.** Revocation/deletion is blocked until explicit owner approval identifies the exact credential and consequences. Emergency containment may disable use locally, but must not silently delete provider credentials.
8. **Auditable decisions.** Record actor, approval reference, provider, capability, scope, environment, credential ID (not value), result, timestamps, and correlation ID. Do not record secret values.
9. **Isolated deployment.** Separate project, repository/environment, service identity, vault namespace, and staging deployment. Production integration is a separate reviewed change.
10. **No production promotion from this scaffold.** This project boundary and policy are design scaffolding; provider adapters, durable approval storage, vault integration, and end-to-end tests must be implemented and verified before live use.

## Lifecycle

Request -> classify capability -> calculate minimum permissions -> policy check -> request owner approval for the exact privileged action -> provision through a supported provider API -> store secret in the vault -> validate token against the intended account/scope -> register non-secret metadata -> issue a short-lived lease/reference to the main application -> audit -> expire/revoke only under approved policy.

On any mismatch, timeout, missing approval, failed validation, provider 401/403, or unavailable vault, fail closed and leave production unchanged.

## Current integration

MOSHARROF already has a Universal Permission Engine and a Cloudflare Token Router in the main repository. This project is intended to be a separate provisioning authority, not a replacement for either. The existing router currently selects already-created credentials and is documented as not production-wired; it does not mint tokens. Integration must use a narrow server-to-server API and opaque credential references, never send raw credentials to MOSHARROF's static Pages frontend.

## Planned components

- `policy/`: versioned allowlists, scopes, approval requirements, TTL limits, and destructive-action denies.
- `providers/`: provider-specific provisioning and validation adapters; unsupported providers return unsupported rather than pretending to work.
- `approval/`: owner approval records bound to immutable action details and expiry.
- `vault/`: interface to a secret manager; no plaintext persistence.
- `leases/`: short-lived, scoped credential references for callers.
- `audit/`: durable append-only security events with secret redaction.
- `tests/`: policy, denial, scope, expiry, redaction, provider error, and approval replay tests.

## Status

**Scaffold only — not yet capable of creating live tokens.** Do not configure production credentials or connect this to MOSHARROF Live until the missing components and provider-specific tests are complete and reviewed.
