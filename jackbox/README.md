# Jackbox / Control Box

New features belong in separate modules under `jackbox/modules/<module-id>/`; they
must not edit verified-core files to attach themselves.

Register modules in `core/jackbox/registry.json` using a unique lowercase ID, an entry path under
that module's own directory, and an explicit `enabled` boolean. The registry is only
a declarative inventory in this first phase: it does not dynamically execute code or
grant browser/device permissions. Runtime integration must be added only after a
separate API contract and security review.

The gate rejects duplicate IDs, invalid paths, path traversal, and entries that point
outside their own module folder. Keep a new module disabled until its contract and
compatibility tests pass.
