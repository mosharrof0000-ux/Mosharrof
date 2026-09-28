# Mosharrof Entity Vitality

## Purpose

The Entity Vitality / Chaitanya layer is the machine-checkable operational heartbeat of Mosharrof. It does not claim literal consciousness. It ensures every registered entity remains structurally alive before autonomous work continues.

For every registered entity it verifies identity, brain assignment, responsibility, memory boundary, tool boundary, permission profile, non-destructive policy, scope, audit boundary, and versioned registry contract.

It also verifies the global safety policy and the brain adapter.

## Runtime behavior

Every autonomous cycle runs `scripts/mosharrof_vitality.py` before the test suite. A blocked entity or unsafe global policy stops the cycle rather than allowing an unhealthy system to continue.

The report is written to `artifacts/vitality/entity-vitality.json`.

A healthy report has `status: ALIVE`, `blocked_count: 0`, and `alive_count == entity_count`.

This makes the “each organ is conscious/alive” requirement an inspectable engineering contract rather than a hidden claim.
