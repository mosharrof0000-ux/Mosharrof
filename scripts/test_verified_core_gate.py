import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from scripts.verified_core_gate import validate_manifest, validate_registry


class VerifiedCoreGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "core/verified-core").mkdir(parents=True)
        (self.root / "core/jackbox").mkdir(parents=True)
        (self.root / "jackbox/modules/demo").mkdir(parents=True)
        (self.root / "jackbox/modules/demo/index.js").write_text("export default {};", encoding="utf-8")
        (self.root / "core/verified-core/locked-files.json").write_text(json.dumps({
            "schema_version": 1,
            "locked_files": []
        }), encoding="utf-8")
        (self.root / "core/jackbox/registry.json").write_text(json.dumps({
            "schema_version": 1,
            "modules": [{
                "id": "demo",
                "path": "jackbox/modules/demo",
                "entry": "jackbox/modules/demo/index.js",
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
            "locked_files": [{"path": "example.txt", "sha256": "0" * 64}]
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
                "entry": "jackbox/modules/demo/../../../../index.html",
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


if __name__ == "__main__":
    unittest.main()
