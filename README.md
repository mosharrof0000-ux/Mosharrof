# Mosharrof

**Mosharrof Karim — Intelligent Entity and AI Brain Architecture**

Mosharrof is an entity-first, model-agnostic AI ecosystem. Each meaningful
component can have its own identity, brain adapter, memory, responsibility,
tools, permissions, policy, communication and audit boundary.

**Actual Capability = AI Brain × Permission × Policy × Scope × Identity**

## Permanent safety rules

- DELETE operations are denied.
- Destructive operations are denied.
- Secrets must not be committed to source code.
- Entity actions remain inside declared responsibility and scope.

## First-read architecture files

1. `config/project_manifest.json`
2. `config/entity_registry.json`
3. `policies/CORE_POLICY.md`
4. `docs/ARCHITECTURE.md`

## Development

Install the test dependency and run:

```bash
python -m pip install -r requirements.txt
python -m pytest -q
```

GitHub Actions runs the same test suite on pushes and pull requests.

## First research tool

Al-Quran Research remains an independent project until explicit integration.

## Deployment

No live web URL is claimed by this repository yet. Deployment will be added
only after a tested web application and an explicit deployment workflow exist.
