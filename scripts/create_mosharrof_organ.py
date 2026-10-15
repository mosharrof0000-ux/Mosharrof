#!/usr/bin/env python3
"""Create an isolated organ scaffold without overwriting files or publishing changes."""
from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path

ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MAX_LINKS_PER_ORGAN = 20

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--organ-id", required=True, help="Unique lowercase kebab-case organ id")
    parser.add_argument("--name", default=None)
    parser.add_argument("--description", default="")
    parser.add_argument("--public-api", action="append", default=[], help="Repeat for each public API")
    parser.add_argument("--dependency", action="append", default=[], help="Repeat as organ-id:api")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    if not ID_RE.fullmatch(args.organ_id):
        parser.error("--organ-id must be lowercase kebab-case")
    if len(args.dependency) > MAX_LINKS_PER_ORGAN:
        parser.error(f"an organ may declare at most {MAX_LINKS_PER_ORGAN} dependencies")
    if len(set(args.public_api)) != len(args.public_api):
        parser.error("public API names must be unique")
    dependencies = []
    for item in args.dependency:
        organ_id, separator, api = item.partition(":")
        if not separator or not ID_RE.fullmatch(organ_id) or not api.strip():
            parser.error(f"invalid --dependency '{item}'; expected organ-id:api")
        dependencies.append({"organ_id": organ_id, "api": api})
    root = args.root.resolve()
    folder = root / "organs" / args.organ_id
    if folder.exists():
        print(f"REFUSED: {folder} already exists; no files changed.", file=sys.stderr)
        return 2
    manifest = {"id": args.organ_id, "name": args.name or args.organ_id.replace("-", " ").title(),
                "description": args.description, "public_api": args.public_api, "dependencies": dependencies}
    files = {
        "organ.json": json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        "index.js": 'export const organId = "' + args.organ_id + '";\nexport function initialize() { return { id: organId, status: "ready" }; }\n',
        "README.md": f"# {manifest['name']}\n\n{args.description or 'Independent Mosharrof organ.'}\n\nPublic APIs are declared in organ.json. Communicate with other organs through approved public API contracts only.\n",
        "tests/README.md": "# Test plan\n\nAdd unit and contract tests for this organ before promotion.\n",
    }
    for relative, content in files.items():
        target = folder / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    print(f"ORGAN SCAFFOLD: PASS — created {folder.relative_to(root)}; not committed or deployed")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
