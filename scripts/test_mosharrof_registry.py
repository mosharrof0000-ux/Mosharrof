#!/usr/bin/env python3
"""Tests for manifest validation, dependency links, registry generation, and safe scaffolding."""
from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from scripts.mosharrof_registry import RegistryError, build_registry


class OrganRegistryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def organ(self, organ_id: str, public_api=None, dependencies=None) -> Path:
        folder = self.root / "organs" / organ_id
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "organ.json").write_text(json.dumps({
            "id": organ_id, "name": organ_id, "public_api": public_api or [],
            "dependencies": dependencies or [],
        }), encoding="utf-8")
        (folder / "index.js").write_text("export {};\\n", encoding="utf-8")
        (folder / "README.md").write_text("test organ\\n", encoding="utf-8")
        (folder / "tests").mkdir(exist_ok=True)
        (folder / "tests" / "README.md").write_text("test plan\\n", encoding="utf-8")
        return folder

    def test_registry_builds_from_manifests_without_manual_index(self) -> None:
        self.organ("voice-engine", ["speak"])
        self.organ("chat-organ", ["send"], [{"organ_id": "voice-engine", "api": "speak"}])
        result = build_registry(self.root)
        self.assertEqual([item["id"] for item in result["organs"]], ["chat-organ", "voice-engine"])
        self.assertEqual(result["organs"][0]["dependencies"], [{"organ_id": "voice-engine", "api": "speak"}])

    def test_unknown_dependency_blocks_registry(self) -> None:
        self.organ("chat-organ", ["send"], [{"organ_id": "missing-organ", "api": "run"}])
        with self.assertRaisesRegex(RegistryError, "unknown organ"):
            build_registry(self.root)

    def test_undeclared_target_api_blocks_registry(self) -> None:
        self.organ("voice-engine", ["speak"])
        self.organ("chat-organ", ["send"], [{"organ_id": "voice-engine", "api": "delete"}])
        with self.assertRaisesRegex(RegistryError, "does not declare public API"):
            build_registry(self.root)

    def test_more_than_twenty_manifest_links_are_blocked(self) -> None:
        self.organ("target-organ", ["api"])
        dependencies = [{"organ_id": "target-organ", "api": "api"} for _ in range(21)]
        self.organ("source-organ", ["run"], dependencies)
        with self.assertRaisesRegex(RegistryError, "21 dependencies exceed the 20-link-per-organ limit"):
            build_registry(self.root)

    def test_manifest_id_must_match_its_folder(self) -> None:
        self.organ("folder-organ", ["run"])
        path = self.root / "organs" / "folder-organ" / "organ.json"
        path.write_text(json.dumps({"id": "different-id", "public_api": []}), encoding="utf-8")
        with self.assertRaisesRegex(RegistryError, "must match folder"):
            build_registry(self.root)

    def test_empty_repo_has_empty_registry(self) -> None:
        self.assertEqual(build_registry(self.root)["organs"], [])

    def test_scaffolder_creates_required_files_and_refuses_overwrite(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        scaffold = repo_root / "scripts" / "create_mosharrof_organ.py"
        result = subprocess.run(
            ["python3", str(scaffold), "--root", str(self.root), "--organ-id", "copy-button", "--public-api", "copy"],
            text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )
        self.assertEqual(result.returncode, 0, result.stdout)
        organ = self.root / "organs" / "copy-button"
        for relative in ("organ.json", "index.js", "README.md", "tests/README.md"):
            self.assertTrue((organ / relative).is_file(), relative)
        second = subprocess.run(
            ["python3", str(scaffold), "--root", str(self.root), "--organ-id", "copy-button"],
            text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )
        self.assertEqual(second.returncode, 2, second.stdout)
        self.assertIn("already exists", second.stdout)

    def test_scaffolder_refuses_twenty_one_dependencies(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        scaffold = repo_root / "scripts" / "create_mosharrof_organ.py"
        args = ["python3", str(scaffold), "--root", str(self.root), "--organ-id", "too-many-links"]
        for index in range(21):
            args.extend(["--dependency", f"target-organ:api-{index}"])
        result = subprocess.run(args, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("at most 20 dependencies", result.stdout)


    def test_organ_without_manifest_or_required_files_blocks_registry(self) -> None:
        folder = self.root / "organs" / "incomplete-organ"
        folder.mkdir(parents=True)
        with self.assertRaisesRegex(RegistryError, "missing required organ.json"):
            build_registry(self.root)


    def test_registry_cli_generates_deploy_artifact(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        script = repo_root / "scripts" / "mosharrof_registry.py"
        result = subprocess.run(
            ["python3", str(script), "--root", str(self.root), "--output", "web/runtime/organs.registry.json"],
            text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )
        self.assertEqual(result.returncode, 0, result.stdout)
        output = self.root / "web" / "runtime" / "organs.registry.json"
        self.assertTrue(output.is_file())
        self.assertEqual(json.loads(output.read_text(encoding="utf-8"))["organs"], [])

if __name__ == "__main__":
    unittest.main(verbosity=2)
