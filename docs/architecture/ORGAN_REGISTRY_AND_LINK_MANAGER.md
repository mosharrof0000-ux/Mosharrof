# Organ registry, links, and safe scaffolding

## Add an organ

Use the scaffold script on a feature branch:

```bash
python3 scripts/create_mosharrof_organ.py --organ-id copy-button --name "Copy Button" --public-api copy
```

Add one `--dependency organ-id:api` for each cross-organ contract, up to 20. The scaffold refuses to overwrite an existing organ and never commits, merges, or deploys anything.

## Registry and link model

- Each `organs/<id>/organ.json` is the source of truth for its unique ID, public APIs, and declared dependencies.
- `scripts/mosharrof_registry.py --validate-only` scans all organ folders, checks required files, validates unique IDs and dependency contracts, and rejects unknown organs/APIs or more than 20 declared dependency links.
- The Pages build generates `web/runtime/organs.registry.json` from manifests. No developer has to maintain a giant central list by hand.
- `core/organ-registry/index.js` validates the generated records at runtime.
- `core/link-manager/index.js` permits only declared links to public APIs. Private cross-organ imports are rejected by the architecture gate.
- Every production source file remains subject to the 20-link limit and source line limits. If a file would exceed the limit, split a coherent group into a dedicated helper/module and declare the contract; do not create a single oversized hub.

## CI proof

The architecture workflow runs positive and negative tests: 20 links pass; 21 module links and 21 HTML links fail; oversized files, direct cross-organ imports, edits to the frozen legacy shell, invalid registry dependencies, and missing comparison bases fail closed. A deliberately invalid PR is kept closed after its gate failure is recorded.
