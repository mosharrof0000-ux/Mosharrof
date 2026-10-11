# Cloudflare token reuse: rollout and operations

## Goal

Avoid repeatedly creating API tokens. Register existing, owner-verified tokens once, then let the server select the least-privileged token that covers each approved operation.

## Architecture

1. **Capability policy** decides whether the signed-in operator/agent may request the operation.
2. **Operation mapping** (trusted server code, not user-provided strings) maps the capability to exact Cloudflare permission names and a resource scope.
3. **Token router** selects a pre-provisioned token using metadata plus its server-side secret environment variable.
4. **Cloudflare API client** uses a fixed api.cloudflare.com host, validates relative paths, and emits redacted audit metadata.
5. **Cloudflare** remains the final authority. A 401/403 is denied immediately; the client never retries with a broader credential.
6. **Owner-controlled provisioning** is a separate, opt-in administrative workflow. It is not exposed to the website or ordinary agents.

## One-time setup

- In Cloudflare, inventory the tokens that already exist and verify each token's real permissions, resources, and expiry.
- Give each token a stable non-secret ID and a server-side secret name, such as CF_ZONE_READ_TOKEN.
- Add the secret value only to the chosen deployment secret manager (Cloudflare Worker secret / server secret store). Never add token values to this repository or GitHub issue/PR comments.
- Populate a private registry from config/cloudflare_token_profiles.example.json; do not enable a profile until the owner confirms the metadata matches Cloudflare.
- Map each server-side operation to minimum permissions and exact resource scope.
- Test in read-only mode first, then run a controlled write test against a non-production resource.

## Token creation policy

Do not pre-create every theoretical combination of permissions. Cloudflare tokens can hold multiple permission groups and policies, while token count and account authorization remain bounded. Prefer a small set of reusable role-based tokens with resource scoping (for example, account inventory read, zone/DNS read, Workers read, Workers deploy, DNS edit). Reuse those tokens for matching requests. Create a new token only when a genuinely new permission/scope boundary cannot be served by an existing token.

A token's permissions are fixed; asking the engine for a new permission cannot expand an existing token. If no token covers an operation, the engine should explain which capability is missing and request owner-managed provisioning. Never silently use an all-powerful token.


**Read-only safety gate:** the Python Cloudflare API client currently permits `GET` only. `POST`, `PUT`, `PATCH`, and `DELETE` are rejected before token resolution. Write operations must remain disabled until a reviewed operation-to-permission policy and non-production tests are added.

## Production gate

This code is a guarded API client primitive, not a complete deployment. Before wiring it to any UI route, the repository owner must provide the deployment environment with verified token secrets and an explicit operation-to-permission map. Then run unit/integration tests, review the diff, merge through the protected workflow, deploy, and verify health. No secret value is needed in chat.

## Audit requirements

Record operation ID, selected token ID, requested permission names, resource scope, outcome, and HTTP status. Never record authorization headers, token values, raw provider error bodies, or user-supplied absolute URLs.
