from pathlib import Path
import shutil
import subprocess


def test_video_worker_contract_is_executed():
    node = shutil.which("node")
    assert node, "Node.js is required for the video Worker contract test"
    result = subprocess.run(
        [node, "tests/test_video_generation_worker.mjs"],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_video_ui_is_disabled_until_owner_enables_provider():
    worker = Path("worker/video-generation/wrangler.toml").read_text(encoding="utf-8")
    ui = Path("core/video-generation-ui.js").read_text(encoding="utf-8")
    prep = Path("scripts/prepare_web_organ_runtime.py").read_text(encoding="utf-8")
    deploy = Path(".github/workflows/deploy-gemini-worker.yml").read_text(encoding="utf-8")
    assert 'VIDEO_GENERATION_ENABLED = "false"' in worker
    assert "VIDEO_GENERATION_ENABLED=true" in ui
    assert "env.FAL_KEY" not in ui
    assert "Authorization: Key" not in ui
    assert "secrets.FAL_KEY" not in ui
    assert '"core/video-generation-ui.js": "web/video-generation-ui.js"' in prep
    assert "mosharrof-video-generation" in deploy
    assert "node --check worker/video-generation/index.js" in deploy
