from pathlib import Path


def test_worker_has_configurable_gemini_tts_model_and_key_failover():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    assert 'GEMINI_TTS_FALLBACK_MODELS' in worker
    for slot in range(2, 6):
        assert f'GEMINI_API_KEY_{slot}' in worker
    assert 'generateWithGeminiTTSWithFailover' in worker
    assert 'all_gemini_tts_routes_failed' in worker
    assert 'failover_attempts' in worker


def test_deploy_workflow_sets_optional_failover_secrets_and_checks_build():
    workflow = Path(".github/workflows/deploy-gemini-worker.yml").read_text(encoding="utf-8")
    assert 'secrets.GEMINI_API_KEY_2' in workflow
    assert 'secrets.GEMINI_API_KEY_5' in workflow
    assert 'secrets.GEMINI_TTS_FALLBACK_MODELS' in workflow
    assert 'MODELS="gemini-2.5-flash-preview-tts"' in workflow
    assert '2026-10-16-cf-v5' in workflow
    assert "Waiting for the newly deployed Worker version to propagate..." in workflow
    assert "for i in {1..12}; do" in workflow
    assert '''grep -q '"worker_build":"2026-10-16-cf-v5"' /tmp/health.json''' in workflow
    assert "expected healthy build" in workflow
