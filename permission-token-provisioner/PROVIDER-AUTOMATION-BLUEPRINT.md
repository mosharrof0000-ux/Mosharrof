# Provider automation blueprint

## Implemented in this branch

- Fail-closed request/approval policy core with exact approval scope, expiry, and replay-denial checks.
- GitHub App installation-token adapter: requests short-lived tokens for explicit repository IDs and permission levels, rejects production, verifies returned permissions, writes the token only to a supplied vault, and returns an opaque handle.
- Cloudflare user-token adapter: requests an explicitly scoped token through the documented `POST /user/tokens` endpoint, validates permission-group IDs/resource scope, enforces a TTL of 1–1440 minutes, rejects production, verifies the provider-returned policy and expiry, writes the token only to a supplied vault, and returns an opaque handle.
- Tests for approval denial, production denial, permission/resource/TTL mismatch, and vault-handle-only return paths.
- Regression fixes in `web/index.html` for two malformed regular expressions that broke the existing image-engine test.

## Required trust services before enabling adapters

These adapters are not production-ready by themselves. A real deployment must provide:

1. A GitHub App created by the owner and installed only on intended repositories. `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, and `GITHUB_APP_PRIVATE_KEY` must be supplied through a secret manager, not repository files or frontend configuration.
2. A Cloudflare bootstrap API token created by the owner through Cloudflare's official flow with the **API Tokens Write** permission. Cloudflare explicitly requires an already authorized token before creating additional tokens; this project cannot bypass that requirement. Keep the bootstrap token separate from normal runtime credentials and do not add it to frontend code or commit it.
3. An authenticated owner-approval service that verifies identity, binds approval to provider/action/permission set/resource IDs/environment/expiry/TTL, and atomically prevents replay. The current adapter contract requires this service but does not implement its authentication.
4. A vault implementation that stores secrets encrypted and returns opaque handles. There is intentionally no default plaintext file, environment-variable, or in-memory production vault.
5. Independent policy review and non-production end-to-end tests before any production integration.

Provider APIs are the authority boundary: this project cannot grant permissions the owner/provider has not authorized. If the App, installation, bootstrap permission, approval service, or vault is missing, the adapter must fail closed.

## Scope semantics

- GitHub approval scope is bound to the exact repository ID list and the exact permission mapping.
- Cloudflare approval scope uses `<resource-key>=*;ttl_minutes=<N>`; the resource key must be a specific account/zone/user resource and must not itself be a wildcard. Permission-group IDs must be exact 32-character IDs and match the approved set.
- Cloudflare token lifetime is capped at 24 hours by this adapter. Shorter lifetimes are preferable.

## Provider strategy

For GitHub, prefer GitHub App installation tokens or supported OIDC/federation over long-lived PATs. For Cloudflare, use the supported token API only with an owner-authorized token-management bootstrap credential. For every future provider, use its supported OAuth/App/delegation flow, request minimum scope, and never silently fall back to a broader token.

## Lifecycle

- Explain in Bengali the capability, provider, exact scope, duration, risk, and side effects before asking for owner approval.
- Authenticate and atomically consume approval once; then provision, store, verify returned scope/expiry, and return only an opaque handle.
- Never print tokens/JWTs/private keys; redact provider errors and request headers.
- A provider token might be created before a vault write fails. Do not silently delete/revoke it: record a redacted incident and require an explicit, separately scoped cleanup approval.
- Do not connect these adapters to Live until real approval authentication, durable replay protection/audit, vault storage, provider contract tests, and rollback checks are independently verified.
