# Mosharrof Component Awareness

Mosharrof now has a deterministic **component-awareness layer**.

It treats every registered entity in `config/entity_registry.json` as an observable system component and verifies, on each autonomous cycle, that it has:
- an identity and registration record;
- a defined responsibility and brain/adapter;
- an explicit scope and permission profile;
- memory, tools and audit locations;
- an explicit non-deletion rule;
- a machine-readable health state.

The monitor writes `artifacts/component-awareness/awareness.json` and fails the cycle if a registered component is incomplete or has deletion enabled.

**Meaning of “awareness”:** this is software-level observability and self-description. It does not claim that the software is sentient or conscious.

## Autonomous gate

The autonomous engine runs this monitor before the existing pytest and browser QA gates. Therefore a component-awareness failure stops promotion before a PR is created.
