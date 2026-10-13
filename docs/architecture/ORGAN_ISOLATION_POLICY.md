# MOSHARROF AI — Mandatory Organ Isolation Policy

This policy is a release requirement, not a style suggestion. A pull request that violates it must fail verification and must not be promoted to the live site.

## Ownership

- Every independently coded feature, action, and button must have its own source module. For example, copy and read-aloud controls are separate files, not logic added to a shared mega-file.
- Every organ lives under organs/<organ-id>/ and owns organ.json, index.js, README.md, and tests/.
- UI components live in the owning organ's components/ directory. Each component file requires a dedicated test at tests/<component-file-stem>.test.js.
- Shared infrastructure belongs in core/; organs must not import another organ's private implementation. Cross-organ communication must use declared public APIs or message contracts.
- A manifest must contain an id matching the folder name and a public_api array.
- New production source outside organs/ or core/ is rejected. CI scripts, tests, docs, configuration, and workflow files are policy tooling, not production feature modules.

## File limits

| Source type | Maximum lines |
| --- | ---: |
| JavaScript, JSX, TypeScript, TSX, MJS, CJS | 250 |
| CSS | 350 |
| HTML templates | 300 |

A file that exceeds its limit must be split by responsibility; increasing the limit to avoid splitting is not an acceptable workaround. Large functions should also be decomposed into small, named units and tested.

## Legacy migration and safety

- web/index.html is the existing legacy shell and is frozen against further edits. Application logic must be migrated into isolated modules before that shell is changed.
- This gate checks changed production files and organ boundaries. It does not falsely certify untouched legacy code as already modular; migration remains explicit work.
- The gate is fail-closed: if its base comparison cannot be performed, verification fails.
- No self-modification, auto-merge, or live deployment is allowed just because a file or organ was generated. Required tests, review/approval, and the repository's protected promotion process still apply.
- Automatic scaffolding may propose/create files, but it must never silently merge or publish them.
