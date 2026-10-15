from pathlib import Path
import subprocess


def test_runtime_image_provider_fallback_after_moderation_rejection():
    script = Path("tests/test_image_provider_fallback_runtime.mjs")
    subprocess.run(["node", str(script)], check=True, timeout=30)
