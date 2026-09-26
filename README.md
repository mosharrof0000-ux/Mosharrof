# Mosharrof

Mosharrof Karim — Intelligent Entity and AI Brain Architecture.

## Foundation

Mosharrof is an entity-first, model-agnostic AI ecosystem. Each meaningful component can have its own identity, brain adapter, memory, responsibility, tools, permissions, policy, communication and audit boundary.

**Actual Capability = AI Brain × Permission × Policy × Scope × Identity**

## Permanent safety rules

- DELETE operations are permanently blocked.
- Destructive operations are permanently blocked.
- Tools cannot exceed their declared permission and responsibility.
- Production activation must follow testing and review.

## First-read architecture files

1. `config/project_manifest.json`
2. `config/entity_registry.json`
3. `policies/CORE_POLICY.md`
4. `docs/ARCHITECTURE.md`

## Current foundation

- Core brain: `src/core/mosharrof_brain.py`
- Event communication: `src/core/event_bus.py`
- Memory ledger: `src/core/memory_ledger.py`
- Tool factory: `src/core/tool_factory.py`
- Capability policy: `src/core/capability_policy.py`
- Storage engine: `src/core/storage_engine.py`
- Voice journal boundary: `src/core/voice_engine.py`

## Testing

Run:

```bash
python -m pytest -q
```

GitHub Actions runs the same test suite for pushes and pull requests.

## Integration boundary

Al-Quran Research remains an independent project until explicit integration is approved. No Al-Quran Research production files are modified by this foundation repair.
