from pathlib import Path
import subprocess


def test_runtime_cloudflare_chat_model_rotation_after_gemini_quota_failure():
    script = Path("tests/test_cloudflare_chat_model_rotation_runtime.mjs")
    subprocess.run(["node", str(script)], check=True, timeout=60)
