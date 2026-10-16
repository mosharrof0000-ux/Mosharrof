from pathlib import Path
import subprocess


def test_personal_memory_engine_persistence_retrieval_and_unbounded_ledger():
    script = Path("tests/personal-memory-engine.test.mjs")
    subprocess.run(["node", "--test", str(script)], check=True, timeout=30)


def test_personal_memory_worker_integration():
    subprocess.run(["node", "--test", "tests/personal-memory-worker-runtime.mjs"], check=True, timeout=30)
