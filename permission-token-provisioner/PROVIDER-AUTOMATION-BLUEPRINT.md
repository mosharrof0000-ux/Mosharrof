# Provider Automation Blueprint: GitHub, Cloudflare, and Future Providers

## User experience goal

The owner gives ordinary-language instructions and approves a clear, exact permission request. After an initial secure provider connection, the owner should not need to manually create individual tokens in provider dashboards for routine future tasks. The isolated engine handles supported provisioning, validation, storage, rotation planning, and scoped credential delivery.

This goal does not imply that the engine can invent provider authority. Provider-side identity, consent, account ownership, subscription restrictions, MFA, or mandatory re-authentication remain authoritative.

## Approval experience

For each new privileged action, present a Bengali-first approval card with:
- provider and account/workspace;
- requesting organ and requested task;
- exact permissions and resources;
- why each permission is needed;
- whether this creates, widens, rotates, revokes, or deletes a credential;
- duration/expiry and expected cost, if applicable;
- risk level and a plain-language consequence summary;
- approve once, deny, or cancel.

Approval is bound to the exact action, permission set, scope, environment, and expiry. It is not reusable for a different request. A previously approved policy may automate repeated low-risk operations only within its precise scope; it cannot silently authorize new privileges or destructive actions.

## GitHub provider strategy

Preferred order:
1. GitHub App installation with only the repository/org permissions needed, short-lived installation access tokens, and scoped repository access.
2. GitHub Actions OIDC federation for supported cloud workloads, avoiding long-lived cloud keys.
3. Fine-grained PAT only as a last-resort, owner-approved bootstrap path where an App/OIDC cannot support the use case.

Requirements:
- Use a dedicated GitHub App or installation identity for the engine, not a personal all-powerful PAT.
- The owner must install/authorize the App and grant the exact repository/org permissions once. This initial grant cannot be skipped by code.
- Request installation tokens at runtime and renew them automatically where supported.
- Never allow the engine to read arbitrary Actions secrets or reveal secret values.
- Creating/updating repository secrets requires a narrowly scoped GitHub App permission and a separate exact approval policy.
- Protect main, required checks, PR review, and production deployment gates.
- Never auto-approve a PR or bypass branch protection just because a token has write access.
- If required permissions are not granted, return a clear approval/connection-required status; do not fall back to a broad personal token.

## Cloudflare provider strategy

Preferred order:
1. Cloudflare-supported OAuth or delegated integration, if available for the exact API and account.
2. A dedicated token-management bootstrap identity stored only in a secret manager, with the minimum supported permissions needed to create narrowly scoped child tokens.
3. An owner-created scoped token as a bootstrap fallback only when the provider API cannot securely delegate the required token-management capability.

Requirements:
- Verify the exact Cloudflare account and zone IDs before any action.
- Token creation through the API requires a pre-authorized identity with token-management permission. The engine cannot grant itself this permission.
- Child tokens must have only the permissions/resources required for the task and the shortest supported lifetime.
- Never use one universal admin token as a routine credential.
- Do not retry a 401/403 with a broader token.
- Keep the existing Cloudflare Token Router as a credential selector, not as a token-minting service; integrate it only after provider adapter and end-to-end tests pass.
- Keep Workers deployment, DNS, Pages, and token-management privileges separate wherever provider scopes permit.

## Generic provider adapter contract

Each adapter must declare:
- supported actions and provider API capabilities;
- exact permission mapping for each action;
- supported credential issuance and expiration behavior;
- whether owner consent or fresh authentication is required;
- validation method for account, permissions, resource scope, and expiry;
- revocation behavior and limitations;
- error mapping and retry policy.

Unsupported provisioning must return unsupported with a plain-language reason. No simulated success and no automatic escalation.

## Automation lifecycle

1. Receive capability request from a registered organ.
2. Validate organ identity, capability registry, policy, environment, and requested resource.
3. Resolve an already verified credential if it covers the request and policy permits reuse.
4. If not, compute the minimum required provider permissions and prepare an exact approval request.
5. After owner approval, verify the approval is authentic, unexpired, scope-bound, and unused.
6. Provision through the provider's supported API using a pre-authorized bootstrap identity.
7. Store secret material directly in the vault; never return raw tokens to the frontend or log them.
8. Validate the resulting credential against the intended provider account, permissions, resource scope, and expiry.
9. Register only non-secret metadata and issue an opaque, short-lived reference to the caller.
10. Audit the decision and result; monitor expiry and request fresh approval before any privileged rotation/revocation action that is not already precisely authorized.
11. On any failure, deny and leave production unchanged.

## Destructive actions and owner control

- Deletion, revocation, permission widening, production deployment, secret replacement, and account-level changes require explicit approval for the exact operation.
- Never interpret a general instruction such as fix everything as blanket approval to delete, revoke, widen permissions, or change production.
- Cancellation stops pending actions where possible. Local credential leases can be disabled for containment; provider-side deletion/revocation is a separate approved action.
- Record immutable approval references and audit metadata, never secret values.

## Bootstrap limitation and one-time setup target

A truly zero-manual-setup system is impossible if the provider has not yet authorized any identity for the engine. The product should minimize this to a one-time owner-controlled connection per provider/account, using a secure OAuth/App installation flow where available. After that, supported token issuance and validation should be automated. If the provider requires dashboard-only consent or fresh MFA, the engine must clearly explain that provider-enforced step rather than claiming it can bypass it.

## Delivery gates

**Gate A — design and unit tests:** policy, scope, approval replay, secret redaction, provider error handling.
**Gate B — staging provider:** real provider adapter with non-production resources and a dedicated secret manager.
**Gate C — adversarial tests:** wrong account, missing scope, expired approval, revoked bootstrap, 401/403, API outage, replay, and attempted privilege escalation.
**Gate D — main-app integration:** server-to-server opaque references only; no secrets in browser; organs request capabilities rather than tokens.
**Gate E — production:** reviewed PR, required checks, explicit owner approval, rollback plan, post-deploy health check.

No gate may be skipped automatically by the provisioning engine.
