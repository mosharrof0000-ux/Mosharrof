# Security boundaries and approval model

## Trust boundaries

- **MOSHARROF frontend:** untrusted client; may request a capability but never receives provider credentials or bootstrap credentials.
- **Main application backend:** caller only; sends a capability request and receives a short-lived opaque credential reference or a denial.
- **Provisioning engine:** isolated service; validates policy and approvals; never assumes that a registered capability is already granted.
- **Secret vault:** only component allowed to persist secret values.
- **Provider API:** final authority for credential creation, scopes, expiry, and validation.
- **Owner approval channel:** must authenticate the owner and bind approval to the exact operation and environment.

## Actions requiring explicit approval

- Create or modify a provider token.
- Grant or widen any permission or resource scope.
- Store or overwrite a secret.
- Rotate or replace credentials.
- Revoke/delete a provider credential or remove a credential profile.
- Deploy or connect the engine to production.
- Run a write/destructive operation against a provider.

Approval is not transferable between different scopes, environments, or operations. Expired, replayed, ambiguous, or mismatched approvals are rejected.

## Safe automation without repeated manual token creation

The engine may automatically reuse an existing credential only when its actual verified scope covers the request and policy explicitly allows that use. It may perform approved read-only health checks and report expiry. New credential creation can be automated only after the owner has explicitly approved the exact provisioning action and a provider-authorized bootstrap identity exists in a dedicated secret manager. A bootstrap credential is not a universal master key and must never be exposed to the main application.

## Deletion safeguard

No autonomous deletion. If a credential must be stopped immediately, the engine may disable its local lease/selection after an approved containment policy, while preserving the provider credential until the owner explicitly approves revocation.

## Required tests before live integration

- Missing/expired/replayed approval is denied.
- Approval for one scope cannot authorize another scope.
- Unregistered provider/action is denied.
- Requested permissions are minimized and never widened on retry.
- Missing vault/bootstrap identity is denied without leaking metadata.
- Provider 401/403 blocks the action and does not try a broader token.
- Secret values are redacted from all logs and audit events.
- Delete/revoke is blocked without exact owner approval.
- Credential validation checks the intended account, permissions, resource scope, and expiry.
- Production calls are impossible from test/staging configuration.
