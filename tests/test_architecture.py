import subprocess
import sys

def test_architecture_manifest_and_entity_registry():
    result = subprocess.run(
        [sys.executable, "scripts/validate_architecture.py"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
