# Mosharrof

Mosharrof Karim — Intelligent Entity and AI Brain Architecture.

## Foundation

Mosharrof is an entity-first, model-agnostic AI ecosystem. Each meaningful component has a machine-readable identity, brain assignment, responsibility, memory boundary, tools, permission profile, policy, scope and audit boundary.

**Actual Capability = AI Brain × Permission × Policy × Scope × Identity**

### Permanent safety rules

- DELETE is permanently blocked.
- Destructive operations are permanently blocked.
- Scope escape is blocked.
- Activation without tests is blocked.

### First-read architecture

1. `config/project_manifest.json`
2. `config/entity_registry.json`
3. `config/model_registry.json`
4. `config/policy.json`
5. `config/permission_profiles.json`
6. `policies/CORE_POLICY.md`
7. `docs/ARCHITECTURE.md`

### Entity structure

Every meaningful component is represented under `entities/<entity-id>/` where appropriate. The registry is the authoritative machine-readable map for identity, responsibility, brain, scope and permission boundaries.

### Model independence

`src/core/brain_adapter.py` separates entity identity from the underlying model/provider. A model can be replaced without changing the entity's identity, responsibility, memory, permission, scope or audit history.

### Context-aware voice engine

The Voice Journal Engine provides an explicit authorization boundary plus a provider-neutral voice-processing pipeline:

- Smart punctuation for transcript text.
- High-confidence contextual Bengali normalization.
- Provider-backed phonetic/audio sanitization without pretending that raw audio can be decoded locally.
- Transcript normalization before social-memory logging.
- Recording remains blocked unless explicit authorization is supplied.

The implementation lives in `src/core/voice_engine.py` and is covered by ecosystem tests.

### First research tool

Al-Quran Research remains an independent project until explicit integration.

## Live site

The GitHub Pages deployment workflow is `.github/workflows/deploy-pages.yml`.

**Live URL:** https://mosharrof0000-ux.github.io/Mosharrof/

Deployment is test-gated: the Pages deployment runs only after the Python test suite succeeds on `main`.

### Autonomous agent activation

The scheduled/manual autonomous pipeline uses a short-lived GitHub App token to create an isolated branch and pull request. To activate that write-capable path, configure these repository-level Actions values (never commit them):

- **Actions variable** `MOSHARROF_APP_CLIENT_ID`: the Client ID of a GitHub App installed on `mosharrof0000-ux/Mosharrof`.
- **Actions secret** `MOSHARROF_APP_PRIVATE_KEY`: the matching App private key PEM.
- The installed App must have repository access to `Mosharrof` and only the permissions needed for the workflow: Contents (write), Pull requests (write), and Checks (read).
- `GEMINI_API_KEY` must remain an Actions secret for model calls.

If the App variable or secret is missing, the workflow safely pauses and records the reason in its Actions summary; it does not print secret values, write files, or claim a PR was created. If token creation reports “Integration not found,” confirm that the Client ID/private key belong to the same App and that the App is installed on this repository. Do not paste private keys or tokens into chat or commit them.
