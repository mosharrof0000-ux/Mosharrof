#!/usr/bin/env python3
"""Integration tests proving the architecture gate passes valid modules and blocks violations."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

SOURCE_ROOT = Path(__file__).resolve().parents[1]
GATE_SOURCE = SOURCE_ROOT / "scripts" / "mosharrof_architecture_gate.py"


class ArchitectureGateIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.repo = Path(self.temp.name)
        (self.repo / "scripts").mkdir()
        shutil.copy2(GATE_SOURCE, self.repo / "scripts" / "mosharrof_architecture_gate.py")
        self.git("init", "-b", "main")
        self.git("config", "user.email", "architecture-gate-test@example.invalid")
        self.git("config", "user.name", "Architecture Gate Test")
        (self.repo / "README.md").write_text("fixture\n", encoding="utf-8")
        self.git("add", ".")
        self.git("commit", "-m", "baseline")
        self.base = self.git("rev-parse", "HEAD")

    def tearDown(self) -> None:
        self.temp.cleanup()

    def git(self, *args: str) -> str:
        result = subprocess.run(
            ["git", *args], cwd=self.repo, check=True, text=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        return result.stdout.strip()

    def add_organ(self, index_source: str) -> None:
        organ = self.repo / "organs" / "test-organ"
        (organ / "tests").mkdir(parents=True)
        (organ / "organ.json").write_text(
            json.dumps({"id": "test-organ", "public_api": []}), encoding="utf-8"
        )
        (organ / "index.js").write_text(index_source, encoding="utf-8")
        (organ / "README.md").write_text("test organ\n", encoding="utf-8")
        (organ / "tests" / "README.md").write_text("test plan\n", encoding="utf-8")
        self.git("add", ".")
        self.git("commit", "-m", "add test organ")

    def run_gate(self) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["python3", "scripts/mosharrof_architecture_gate.py", self.base],
            cwd=self.repo, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )

    @staticmethod
    def imports(count: int) -> str:
        return "".join(f'import * as dep{i} from "package-{i}";\n' for i in range(count)) + "export {};\n"

    def test_twenty_module_links_pass(self) -> None:
        self.add_organ(self.imports(20))
        result = self.run_gate()
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn('"status": "PASS"', result.stdout)

    def test_twenty_one_module_links_are_blocked(self) -> None:
        self.add_organ(self.imports(21))
        result = self.run_gate()
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("21 links exceeds the 20-link-per-file limit", result.stdout)
        self.assertIn("No promotion is permitted", result.stdout)

    def test_side_effect_imports_are_counted(self) -> None:
        source = "".join(f'import "side-effect-{i}";\n' for i in range(21))
        self.add_organ(source)
        result = self.run_gate()
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("21 links exceeds the 20-link-per-file limit", result.stdout)

    def test_twenty_one_html_links_are_blocked(self) -> None:
        # HTML is also a production source file and must be kept under the same link cap.
        self.add_organ("export {};\n")
        html = self.repo / "organs" / "test-organ" / "components" / "view.html"
        html.parent.mkdir(parents=True)
        html.write_text("".join(f'<a href="/resource/{i}">x</a>\n' for i in range(21)), encoding="utf-8")
        self.git("add", ".")
        self.git("commit", "-m", "add excessive HTML links")
        result = self.run_gate()
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("21 links exceeds the 20-link-per-file limit", result.stdout)

    def test_missing_comparison_base_fails_closed(self) -> None:
        self.add_organ(self.imports(1))
        result = subprocess.run(
            ["python3", "scripts/mosharrof_architecture_gate.py", "missing-base-ref"],
            cwd=self.repo, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )
        self.assertEqual(result.returncode, 2, result.stdout)
        self.assertIn("cannot compare", result.stdout)


    def test_oversized_source_file_is_blocked(self) -> None:
        self.add_organ("const ready = true;\n" * 251)
        result = self.run_gate()
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("251 lines exceeds the 250-line limit", result.stdout)

    def test_existing_oversized_file_is_blocked_even_when_unchanged(self) -> None:
        # The size gate must audit the whole production tree, not only changed paths.
        self.add_organ("const ready = true;\\n" * 251)
        self.base = self.git("rev-parse", "HEAD")
        (self.repo / "README.md").write_text("unrelated documentation change\\n", encoding="utf-8")
        self.git("add", "README.md")
        self.git("commit", "-m", "change unrelated documentation")
        result = self.run_gate()
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("251 lines exceeds the 250-line limit", result.stdout)

    def test_oversized_json_manifest_is_blocked(self) -> None:
        self.add_organ("export {};\\n")
        manifest = self.repo / "organs" / "test-organ" / "organ.json"
        manifest.write_text(json.dumps({"id": "test-organ", "public_api": [], "notes": ["x"] * 250}, indent=2), encoding="utf-8")
        self.git("add", ".")
        self.git("commit", "-m", "add oversized organ manifest")
        result = self.run_gate()
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("lines exceeds the 200-line limit", result.stdout)

    def test_legacy_shell_replacement_is_blocked(self) -> None:
        shell = self.repo / "web" / "index.html"
        shell.parent.mkdir(parents=True)
        shell.write_text("<html>replacement</html>\n", encoding="utf-8")
        self.git("add", ".")
        self.git("commit", "-m", "attempt legacy shell replacement")
        result = self.run_gate()
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("web/index.html is frozen legacy shell", result.stdout)

    def test_cross_organ_private_import_is_blocked(self) -> None:
        self.add_organ('import { privateThing } from "../target-organ/index.js";\nexport {};\n')
        target = self.repo / "organs" / "target-organ"
        (target / "tests").mkdir(parents=True)
        (target / "organ.json").write_text(
            json.dumps({"id": "target-organ", "public_api": ["publicThing"]}), encoding="utf-8"
        )
        (target / "index.js").write_text("export const privateThing = 1;\n", encoding="utf-8")
        (target / "README.md").write_text("target\n", encoding="utf-8")
        (target / "tests" / "README.md").write_text("tests\n", encoding="utf-8")
        self.git("add", ".")
        self.git("commit", "-m", "add target organ")
        result = self.run_gate()
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("direct cross-organ import", result.stdout)


    def test_dynamic_import_require_and_reexport_links_are_counted(self) -> None:
        source = "".join(
            (f'import("dynamic-{i}");\n' if i % 3 == 0 else
             f'const dep{i} = require("required-{i}");\n' if i % 3 == 1 else
             f'export {{ default as dep{i} }} from "reexport-{i}";\n')
            for i in range(21)
        )
        self.add_organ(source)
        result = self.run_gate()
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("21 links exceeds the 20-link-per-file limit", result.stdout)

    def test_twenty_one_css_resource_links_are_blocked(self) -> None:
        self.add_organ("export {};\n")
        css = self.repo / "organs" / "test-organ" / "components" / "view.css"
        css.parent.mkdir(parents=True)
        css.write_text("".join(f'.item-{i} {{ background: url("/asset/{i}.svg"); }}\n' for i in range(21)), encoding="utf-8")
        self.git("add", ".")
        self.git("commit", "-m", "add excessive CSS links")
        result = self.run_gate()
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("21 links exceeds the 20-link-per-file limit", result.stdout)

if __name__ == "__main__":
    unittest.main(verbosity=2)
