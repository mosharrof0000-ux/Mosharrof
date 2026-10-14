# MOSHARROF Permission & Token Provisioning Engine

This is an isolated server-side project for requesting, validating, and provisioning provider credentials for MOSHARROF AI. It must never be imported into browser code or expose provider credentials to the static Pages frontend.

## Implemented in this branch

- Deny-by-default policy core with exact action/provider/permission/resource/environment matching, expiry checks, and replay-denial support.
- HMAC-signed approval verifier with constant-time signature comparison and atomic SQLite replay protection for isolated staging/single-instance deployments.
- GitHub App adapter for short-lived installation tokens, explicit repository IDs, least-privilege permission levels, unexpected-permission rejection, and opaque vault handles.
- Cloudflare user-token adapter using the documented `POST /user/tokens` endpoint, exact permission-group IDs/resource key, 1–1440 minute expiry, returned-policy validation, and opaque vault handles.
- Unit tests for approval replay/tampering, denied approvals, production denial, exact scope/TTL, and token redaction from adapter return values.
- Two malformed regular expressions in `web/index.html` corrected after the existing image-engine test exposed them.

## Security contract

1. **Deny by default.** Unknown provider, capability, resource, permission, or operation is denied.
2. **Approval before privileged actions.** Credential creation, permission changes, secret-store writes, rotation, revocation, deletion, production connections, and provider mutations require a valid, unexpired owner approval bound to the exact action, provider, scope, environment, and TTL.
3. **No privilege escalation.** Never broaden a token to make a request succeed. If no credential covers the request, return approval-required or unsupported.
4. **Provider authority is mandatory.** A provider token can only be created when a provider-supported bootstrap identity has the exact token-management rights required. No provider control can be bypassed.
5. **Least privilege and short lifetime.** Request the narrowest permissions and shortest supported TTL. The Cloudflare adapter caps the lifetime at 24 hours.
6. **Secrets never leave the vault boundary.** No token values in source control, browser payloads, logs, issue comments, PRs, or audit records.
7. **Deletion is not autonomous.** Revocation/deletion requires separate explicit owner approval. If a token is created but vault storage fails, do not silently delete it; raise a redacted incident for approved cleanup.
8. **Auditable decisions.** Record actor, approval reference, provider, capability, scope, environment, credential ID (not value), result, timestamps, and correlation ID.
9. **Isolated deployment.** Separate service identity, vault namespace, and staging deployment. Production integration is a separate reviewed change.
10. **No production promotion yet.** The adapters require a trusted owner-approval service and a real vault. Those are not yet connected to MOSHARROF Live.

## One-time provider bootstrap

### GitHub

An owner must create a GitHub App and install it only on the intended repository/repositories. Supply `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, and `GITHUB_APP_PRIVATE_KEY` through a server-side secret manager. Installation tokens are limited to permissions available to that App installation. Do not use a long-lived broad PAT as an invisible fallback.

### Cloudflare

Cloudflare requires an initial authorized token before API token creation can be automated. The owner must create a bootstrap token using Cloudflare's official **Create additional tokens** flow / **API Tokens Write** permission. Cloudflare recommends not combining token-management authority with unrelated permissions. Store the bootstrap credential in the server-side secret manager as `CLOUDFLARE_TOKEN_MINTING_BOOTSTRAP`; never put it in GitHub source, a browser bundle, or chat. The adapter then creates scoped tokens through the API and applies an explicit expiry.

This one-time authorization cannot be skipped by code. After it is securely configured, future supported token creation can be automated after per-action approval.

## Approval service

`src/provisioner/approval.py` provides HMAC verification and atomic replay protection. The signing secret must exist only in an authenticated owner-approval backend. The SQLite implementation is intended for staging/single-instance use on persistent storage; it is not a multi-instance production database. Production requires a shared transactional store, authenticated owner UI/API, durable audit, and independent security review.

## Vault requirement

Provider adapters accept a vault interface and return only opaque handles. A real encrypted Vault integration must be configured before any provider adapter is enabled. No plaintext-file or environment-variable vault fallback is provided.

## Current MOSHARROF integration

MOSHARROF already has a Universal Permission Engine and a Cloudflare Token Router. This provisioner is intended to be a separate provisioning authority, not a replacement. The router selects existing credentials; it does not mint them. Integration must use a narrow server-to-server API and opaque credential references, never raw tokens in the static Pages frontend.

## Lifecycle

Request -> classify capability -> calculate minimum permissions -> show Bengali approval summary -> authenticate and consume exact owner approval once -> provision via supported provider API -> store in encrypted vault -> verify returned scope and expiry -> return opaque handle -> audit. Any mismatch, timeout, missing approval, provider rejection, or vault outage fails closed.

## Status

**Non-production implementation in progress.** Policy, signed approval verification, GitHub App token adapter, and Cloudflare token adapter are implemented with unit tests. The real owner approval UI/API, production-grade shared replay store, encrypted Vault connection, durable audit, provider end-to-end tests, and MOSHARROF app integration remain outstanding. Do not connect to Live or promote this PR until these gates pass.
