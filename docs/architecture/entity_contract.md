# Entity Contract

Every meaningful Mosharrof component is an independent Entity.

Required fields:

1. Identity
2. Brain / model adapter
3. Responsibility
4. Working memory
5. Long-term memory
6. Permissions
7. Policy
8. Tools
9. Communication
10. State
11. Audit
12. Version

An entity may act only inside its declared responsibility, permission, policy, and scope.

Capability is evaluated as:

`Actual Capability = Model × Permission × Policy × Scope`

Model replacement must not silently replace identity, memory, history, or policy.

DELETE and destructive operations are permanently denied by the Core policy.
