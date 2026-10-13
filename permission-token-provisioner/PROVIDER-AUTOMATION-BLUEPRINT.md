# Provider automation blueprint

## Implemented in this branch

- Fail-closed request/approval policy core.
- GitHub App installation-token adapter in src/provisioner/github_app.py. It requests a short-lived installation token for explicit repository IDs and permission levels, requires an external approval service to authenticate and atomically consume the owner approval, rejects production, validates returned permissions, and writes the token only to a supplied vault adapter. Callers receive an opaque vault handle, never the raw token.
- Unit tests for denied approval, production denial, permission mismatch, and missing repository scope.

## Required trust services before enabling the adapter

This adapter is not production-ready by itself. A real deployment must provide:

1. A GitHub App created by the owner and installed only on the intended repository. GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, and GITHUB_APP_PRIVATE_KEY must be supplied through a secret manager, not repository files or frontend configuration.
2. An authenticated owner-approval service that verifies identity, binds approval to provider/action/permission set/repository IDs/environment/expiry, and atomically prevents replay.
3. A vault implementation that stores secrets encrypted and returns opaque handles. The adapter deliberately has no default file, environment, or in-memory secret store.
4. Independent policy review and non-production end-to-end test before any production integration.

The GitHub App is the authority boundary: this adapter cannot grant permissions the App was not approved for. Installation tokens are short-lived and can only request permissions available to that installation. If the App or installation is not configured, the adapter fails closed.

## Scope semantics

The approved Request.permission_set uses permission:level entries (for example contents:read). The adapter requires this set to equal the requested GitHub permission mapping. The caller must bind resource_scope to the same repository selection in the trusted approval service; do not rely on the display string alone.

## Cloudflare and other providers

Cloudflare token creation requires an already authorized token-management credential or supported delegated authorization. This repository must not infer or fabricate that authority. Build and test the Cloudflare adapter only after the owner establishes a narrowly scoped bootstrap credential through Cloudflare's official authorization flow. The same rule applies to every future provider: use the provider's supported OAuth/App/delegation flow, request minimum scope, and never silently fall back to a broader token.

## Lifecycle

- Ask permission in Bengali before privileged actions, describing capability, provider, exact scope, duration, risk, and side effects.
- After approval, authenticate and consume approval once, provision the narrow credential, store it in a vault, verify provider-returned scope and expiry, then return only the vault handle.
- Never print token/JWT/private key; redact provider errors and request headers.
- Revoke expired or no-longer-needed credentials only under an explicit, separately scoped owner approval or a narrowly pre-approved cleanup policy. No deletion or revocation by default.
- Do not connect this adapter to Live until durable audit, approval authentication, vault storage, provider contract tests, and rollback checks are independently verified.
