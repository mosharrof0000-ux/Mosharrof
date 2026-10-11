# Cloudflare token router (v1)

## Purpose

Mosharrof has a capability catalogue and a trusted permission engine. This module adds a separate, fail-closed selector for already-created Cloudflare API tokens. It selects the narrowest enabled credential whose declared permissions and resource scope cover the request.

It does not create Cloudflare tokens, grant permissions, or bypass Cloudflare's server-side authorization. A profile is metadata, not a grant.

## Important token model

- A Cloudflare API token's permissions are fixed when the token is created. Mosharrof cannot ask an existing token for extra rights.
- Do not create one all-powerful token merely to avoid prompts. Use narrow role-based tokens where practical (for example, Workers read, Workers deploy, DNS read) and ask for owner approval for sensitive operations.
- Never commit token values to Git, JSON files, browser code, issues, logs, or PRs.
- Store values only in the server-side secret store used by the deployment. The browser must never receive them.
- Creating tokens through the Cloudflare API requires an already-authorized bootstrap credential with token-management permission. That bootstrap credential is highly sensitive and must not be placed in the website or general-purpose agent.
- The engine may request a permission or report that no credential covers it; it must not self-grant permissions or mint a replacement token without a separately authorized owner-controlled provisioning workflow.

## Registry format

Copy config/cloudflare_token_profiles.example.json to a private deployment configuration source and replace example values. Keep the file as metadata only; secret_env names environment variables configured in the deployment secret store.

Each profile requires a unique token_id, secret environment variable name, explicit Cloudflare permission names, explicit resource scopes, and enabled: true only after the owner verifies the token's actual scope in Cloudflare.

## Runtime contract

1. The application permission engine authorizes the requested capability and policy.
2. The caller maps that capability to the exact Cloudflare API permission(s) required.
3. CloudflareTokenRouter.resolve() selects a pre-provisioned token whose metadata covers every required permission and the requested resource scope.
4. Missing secret, disabled profile, scope mismatch, or missing permission fails closed.
5. Audit only the token ID and requested operation/scope. Never log the token value.
6. After selecting a token, the actual Cloudflare API remains the final authority; handle 401/403 by denying the operation and alerting the owner. Do not silently retry with a broader token.

## Not yet production-wired

This is a server-side routing primitive. It must be wired into the real Cloudflare API adapter/Worker, configured with actual verified tokens, and tested against the intended Cloudflare account before it can be called live. The static GitHub Pages frontend must not call Cloudflare APIs with secret tokens directly.
