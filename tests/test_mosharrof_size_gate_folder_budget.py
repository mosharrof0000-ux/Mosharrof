import json
from pathlib import Path

from scripts.mosharrof_size_gate import folder_budget_file, source_file

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "config" / "file_folder_size_gate.json"


def test_folder_budget_counts_production_code_not_tests_or_organ_metadata():
    config = json.loads(POLICY.read_text(encoding="utf-8"))
    assert folder_budget_file("organs/example/components/read-aloud.js", config)
    assert not folder_budget_file("organs/example/tests/read-aloud.test.js", config)
    assert not folder_budget_file("organs/example/organ.json", config)
    assert not folder_budget_file("organs/example/README.md", config)
    assert source_file("organs/example/tests/read-aloud.test.js", config)
