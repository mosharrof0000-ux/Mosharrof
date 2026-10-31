from pathlib import Path

from webview_layout_diagnostics import CDP_COMMAND_TIMEOUT_SECONDS


def test_cdp_timeout_budget_covers_observed_slow_renderer_frames():
    source = Path(__file__).with_name("apk_webview_real_chat_smoke.py").read_text(encoding="utf-8")
    assert CDP_COMMAND_TIMEOUT_SECONDS == 45
    assert "timeout: float = CDP_COMMAND_TIMEOUT_SECONDS" in source
    assert 'report["last_cdp_method"] = cdp.last_command if cdp else None' in source
