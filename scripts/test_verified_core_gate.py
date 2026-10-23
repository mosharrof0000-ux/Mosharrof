import json
import tempfile
import unittest
from pathlib import Path

from scripts.verified_core_gate import locked_change_errors, manifest_paths, validate_manifest, validate_registry


class VerifiedCoreGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "core/verified-core").mkdir(parents=True)
        (self.root / "core/jackbox").mkdir(parents=True)
        (self.root / "organs/demo").mkdir(parents=True)
        (self.root / "organs/demo/index.js").write_text("export default {};", encoding="utf-8")
        (self.root / "organs/demo/organ.json").write_text(json.dumps({"id": "demo", "public_api": ["getHealth", "reportIssue"], "dependencies": []}), encoding="utf-8")
        (self.root / "core/verified-core/locked-files.json").write_text(json.dumps({
            "schema_version": 1,
            "locked_files": []
        }), encoding="utf-8")
        (self.root / "core/jackbox/registry.json").write_text(json.dumps({
            "schema_version": 1,
            "modules": [{
                "id": "demo",
                "path": "organs/demo",
                "entry": "organs/demo/index.js",
                "enabled": False
            }]
        }), encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def test_empty_manifest_is_valid_bootstrap(self):
        self.assertEqual(validate_manifest(self.root), [])

    def test_hash_mismatch_fails(self):
        target = self.root / "example.txt"
        target.write_text("actual", encoding="utf-8")
        manifest = {
            "schema_version": 1,
            "locked_files": [{"path": "example.txt", "sha256": "0" * 64, "evidence": {
                "verified_commit": "a" * 40,
                "test_runs": ["https://github.com/example/repo/actions/runs/123"],
                "dependency_review": "fixture dependency review",
                "acceptance": "fixture acceptance tests passed",
                "verified_at": "2026-10-23"
            }}]
        }
        (self.root / "core/verified-core/locked-files.json").write_text(json.dumps(manifest), encoding="utf-8")
        self.assertTrue(any("SHA-256 mismatch" in e for e in validate_manifest(self.root)))

    def test_valid_module_registry(self):
        self.assertEqual(validate_registry(self.root), [])

    def test_path_traversal_is_rejected(self):
        registry = {
            "schema_version": 1,
            "modules": [{
                "id": "demo",
                "path": "jackbox/modules/demo",
                "entry": "organs/demo/../../../../index.html",
                "enabled": False
            }]
        }
        (self.root / "core/jackbox/registry.json").write_text(json.dumps(registry), encoding="utf-8")
        self.assertTrue(validate_registry(self.root))

    def test_duplicate_module_ids_are_rejected(self):
        registry = json.loads((self.root / "core/jackbox/registry.json").read_text(encoding="utf-8"))
        registry["modules"].append(dict(registry["modules"][0]))
        (self.root / "core/jackbox/registry.json").write_text(json.dumps(registry), encoding="utf-8")
        self.assertTrue(any("duplicate module id" in e for e in validate_registry(self.root)))

    def test_locked_file_cannot_be_changed_while_adding_its_lock(self):
        errors = locked_change_errors(set(), {"src/stable.js"}, {"src/stable.js", "core/verified-core/locked-files.json"})
        self.assertTrue(any("src/stable.js" in error for error in errors))

    def test_locked_file_cannot_be_changed_while_removing_its_lock(self):
        errors = locked_change_errors({"src/stable.js"}, set(), {"src/stable.js", "core/verified-core/locked-files.json"})
        self.assertTrue(any("src/stable.js" in error for error in errors))

    def test_symlink_cannot_be_locked(self):
        target = self.root / "real.txt"
        target.write_text("safe", encoding="utf-8")
        link = self.root / "linked.txt"
        try:
            link.symlink_to(target)
        except (OSError, NotImplementedError):
            self.skipTest("symlinks are not supported on this runner")
        manifest = {
            "schema_version": 1,
            "locked_files": [{"path": "linked.txt", "sha256": "0" * 64}]
        }
        (self.root / "core/verified-core/locked-files.json").write_text(json.dumps(manifest), encoding="utf-8")
        self.assertTrue(any("symbolic links cannot be locked" in e for e in validate_manifest(self.root)))

    def test_malformed_lock_entry_fails_closed(self):
        with self.assertRaises(ValueError):
            manifest_paths({"locked_files": ["src/stable.js"]}, "test manifest")

    def test_duplicate_locked_paths_fail_closed(self):
        entry = {"path": "src/stable.js", "sha256": "a" * 64}
        with self.assertRaises(ValueError):
            manifest_paths({"locked_files": [entry, dict(entry)]}, "test manifest")

    def test_lock_without_evidence_is_rejected(self):
        target = self.root / "example.txt"
        target.write_text("actual", encoding="utf-8")
        manifest = {
            "schema_version": 1,
            "locked_files": [{"path": "example.txt", "sha256": "a" * 64}]
        }
        (self.root / "core/verified-core/locked-files.json").write_text(json.dumps(manifest), encoding="utf-8")
        self.assertTrue(any("evidence object is required" in e for e in validate_manifest(self.root)))


if __name__ == "__main__":
    unittest.main()
