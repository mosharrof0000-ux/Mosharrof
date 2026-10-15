from pathlib import Path
import subprocess


def test_runtime_chat_provider_fallback_chain_with_mocked_upstreams():
    script = Path("tests/test_chat_provider_failover_runtime.mjs")
    subprocess.run(["node", str(script)], check=True, timeout=30)
