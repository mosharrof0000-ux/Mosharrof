from pathlib import Path


def test_manual_audio_transcription_preflight_is_non_billing_and_scoped_to_live_worker():
    workflow = Path(".github/workflows/audio-transcription-preflight.yml").read_text(encoding="utf-8")

    assert "workflow_dispatch:" in workflow
    assert "permissions:\n  contents: read" in workflow
    assert "mosharrof-screenshot-analysis.mosharrof0000.workers.dev" in workflow
    assert 'transcribe_audio_endpoint' in workflow
    assert 'curl' in workflow
    assert 'OPTIONS' in workflow
    assert 'application/x-invalid' in workflow
    assert 'test "$CODE" = "400"' in workflow
    assert "No Gemini transcription request was made" in workflow
    assert "secrets." not in workflow
    assert "wrangler deploy" not in workflow
