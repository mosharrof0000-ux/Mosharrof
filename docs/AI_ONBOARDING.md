# Mosharrof AI Onboarding

A new AI or agent should understand this project in this order:

1. Read `config/project_manifest.json`.
2. Read `config/entity_registry.json`.
3. Read `policies/CORE_POLICY.md`.
4. Read `docs/ARCHITECTURE.md`.
5. Open only the entity folder relevant to the assigned task.
6. Read that entity's `ENTITY.json`, memory boundary, tools boundary and audit boundary.
7. Check permission and scope before taking an action.
8. Test changes before activation.
9. Record important lifecycle/capability decisions in audit.
10. Never request or execute DELETE/destructive operations.

The Core does not automatically inherit the private state of child entities. Each entity has its own identity, responsibility, brain adapter, memory, tools, scope and audit boundary.

Al-Quran Research is an external project boundary and must not be modified from this repository unless an explicit integration task authorizes it.
