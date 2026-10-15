import json
import subprocess
import sys
from pathlib import Path

from scripts.mosharrof_size_gate import line_limit

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


def test_size_gate_preserves_stricter_existing_language_line_caps():
    config = json.loads(POLICY.read_text(encoding="utf-8"))
    assert config["line_limits_by_extension"][".js"] == 250
    assert config["line_limits_by_extension"][".ts"] == 250
    assert config["line_limits_by_extension"][".css"] == 350
    assert config["line_limits_by_extension"][".html"] == 300
    assert line_limit("organs/example/index.js", config) == 250
    assert line_limit("core/example/styles.css", config) == 350
    assert line_limit("web/template.html", config) == 300
    assert line_limit("scripts/utility.py", config) == config["limits"]["max_file_lines"]
