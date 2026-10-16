from pathlib import Path
import subprocess


def test_personal_memory_engine_persistence_retrieval_and_unbounded_ledger():
    script = Path("tests/test_personal_memory_engine.mjs")
    subprocess.run(["node", str(script)], check=True, timeout=30)
