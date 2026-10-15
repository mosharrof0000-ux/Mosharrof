import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "mosharrof_size_gate.py"
POLICY = ROOT / "config" / "file_folder_size_gate.json"


def test_size_gate_policy_has_finite_file_and_folder_limits():
    config = json.loads(POLICY.read_text(encoding="utf-8"))
    limits = config["limits"]
    assert limits["max_file_bytes"] > 0
    assert limits["max_file_lines"] > 0
    assert limits["max_folder_source_bytes"] > 0
    assert limits["max_folder_source_files"] > 0
    assert config["gate_rules"]["fail_closed_when_base_missing"] is True
    assert config["gate_rules"]["legacy_oversize_must_not_grow"] is True


def test_size_gate_fails_closed_if_base_ref_is_missing():
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--base", "refs/heads/definitely-not-a-real-base"],
        cwd=ROOT, text=True, capture_output=True,
    )
    assert result.returncode == 2
    assert "SIZE GATE BLOCKED" in result.stderr
