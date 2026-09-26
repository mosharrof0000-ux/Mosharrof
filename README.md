# Mosharrof

**Mosharrof Karim — Intelligent Entity and AI Brain Architecture**

## Foundation

Mosharrof is organized as a modular ecosystem in which each meaningful component can have its own identity, brain adapter, memory, tools, communication channel, permissions, policy, state, and audit trail.

### Core rules

- Model-agnostic architecture: models can be replaced without replacing entity identity or policy.
- Entity responsibilities are explicit and registry-driven.
- Permissions are capability boundaries, not suggestions.
- DELETE and destructive operations are permanently blocked.
- New entities should be added through the entity registry instead of scattered files.
- The project manifest is the first reference for a new AI or agent entering the project.
- Al-Quran Research is intended to become the first connected research tool/project.

## Live site

GitHub Pages project site:
https://mosharrof0000-ux.github.io/Mosharrof/

## Structure

- `config/project_manifest.json` — machine-readable project identity and rules.
- `config/entity_registry.json` — machine-readable entity map.
- `src/core/` — core engines and policy boundaries.
- `tests/` — automated integration tests.
- `index.html` — live foundation interface.
- `.github/workflows/test-and-deploy.yml` — test-gated Pages deployment.
