# Mosharrof Operational Consciousness

This system uses **operational consciousness** to mean observable awareness of the project's own components and their runtime readiness. It does not claim machine sentience.

## What is active

Each registered component has:
- identity and role
- required files
- alive/impaired state
- critical/non-critical status
- heartbeat timestamp
- machine-readable evidence

The audit is read-only. It never deletes files, changes main, exposes secrets, or changes permissions.

## Flow

component registry → heartbeat audit → JSON evidence → required-check failure when a critical component is missing → protected PR promotion.

## Recovery rule

A failure is a signal, not permission to bypass protection. The next engineering cycle investigates the failed component on an isolated branch, tests the repair, and promotes it only through the protected PR path.

## Current registered organs

Core UI, autonomous engine, visual QA, operation policy, deployment, and verification gate are registered as critical project organs.
