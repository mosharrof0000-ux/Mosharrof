# MOSHARROF AI — Mandatory Organ Isolation Policy

This policy is a release requirement, not a style suggestion. A pull request that violates it must fail verification and must not be promoted to the live site.

## Ownership

- Every independently coded feature, action, and button must have its own source module. For example, copy and read-aloud controls are separate files, not logic added to a shared mega-file.
- Every organ lives under `organs/<organ-id>/` and owns `organ.json`, `index.js`, `README.md`, and `tests/`.
- UI components live in the owning organ's `components/` directory. Each component file requires a dedicated test at `tests/<component-file-stem>.test.js`.
- Shared infrastructure belongs in `core/`; organs must not import another organ's private implementation. Cross-organ communication must use declared public APIs or message contracts.
- A manifest must contain an `id` matching the folder name and a `public_api` array.
- New production source outside `organs/` or `core/` is rejected. CI scripts, tests, docs, configuration, and workflow files are policy tooling, not production feature modules.

## File limits

| Source type | Maximum lines |
| --- | ---: |
| JavaScript, JSX, TypeScript, TSX, MJS, CJS | 250 |
| CSS | 350 |
| HTML templates | 300 |

A file that exceeds its limit must be split by responsibility; increasing the limit to avoid splitting is not an acceptable workaround. Large functions should also be decomposed into small, named units and tested.

## Mandatory connection/link limit

- **One production source file may declare at most 20 module/dependency links** (imports, dynamic imports, or `require` calls).
- The 21st link is forbidden. Before adding it, create a dedicated helper/link module and move a coherent group of related dependencies there; the original file must connect to that module through its public interface.
- The helper/link module is subject to the same 20-link cap and all file-size, ownership, test, and cross-organ rules. Do not evade the cap by moving every link into one oversized hub.
- Link modules must be split hierarchically as needed. Each file/node in the link graph must respect the cap, so the architecture can scale to hundreds or thousands of organs without a single giant connection file.
- The architecture gate counts declared import/dependency links in changed production source files and fails the build when a file exceeds the cap. Do not increase the cap to avoid splitting.

## Legacy migration and safety

- `web/index.html` is the existing legacy shell and is frozen against further edits. Application logic must be migrated into isolated modules before that shell is changed.
- This gate checks changed production files and organ boundaries. It does not falsely certify untouched legacy code as already modular; migration remains explicit work.
- The gate is fail-closed: if its base comparison cannot be performed, verification fails.
- No self-modification, auto-merge, or live deployment is allowed just because a file or organ was generated. Required tests, review/approval, and the repository's protected promotion process still apply.
- Automatic scaffolding may propose/create files, but it must never silently merge or publish them.
