from pathlib import Path


def test_tts_frontend_restores_pre_download_single_request_playback():
    html = Path("web/index.html").read_text(encoding="utf-8")
    start = html.index("function speakText(")
    end = html.index("function parseImageSpec(", start)
    speak = html[start:end]

    # The pre-download implementation sends one complete request and plays the
    # returned audio directly; it does not progressively fetch chunks.
    assert 'fetch(TTS_WORKER_URL,{method:"POST"' in speak
    assert 'new Audio("data:"+(data.mime_type||"audio/mpeg")+";base64,"+data.audio_data)' in speak
    assert "splitSpeechChunks(" not in speak
    assert "showDownloadButton(" not in speak
    assert "combineAudioParts(" not in html


def test_tts_frontend_restores_valid_markdown_cleanup():
    html = Path("web/index.html").read_text(encoding="utf-8")
    assert "if(clean)return clean;" in html
    assert "if(cleanareturn clean;" not in html


def test_tts_health_reports_server_providers_and_configuration():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")

    assert "tts_providers:TTS_PROVIDERS" in worker
    assert "gemini_tts_configured:!!env.GEMINI_API_KEY" in worker
    assert "azure_tts_configured:!!env.AZURE_SPEECH_KEY&&!!env.AZURE_SPEECH_REGION" in worker
    assert 'const TTS_PROVIDERS=["edge","gemini","azure","elevenlabs","sarvam"]' in worker


def test_gemini_38_tts_uses_interactions_api_not_generate_content():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    start = worker.index("async function generateWithGeminiTTS(")
    end = worker.index("async function generateWithAzure(", start)
    tts = worker[start:end]

    assert '"/v1beta/interactions"' in tts or '"https://generativelanguage.googleapis.com/v1beta/interactions"' in tts
    assert 'type:"user_input"' in tts
    assert 'response_format:{type:"audio"}' in tts
    assert 'generation_config:{speech_config:[{voice}]}' in tts
    assert 'part?.type==="audio"&&part?.data' in tts
    assert 'models/"+encodeURIComponent(model)+":generateContent' in tts
    assert 'if(/^gemini-3[.]8-flash(?:-lite)?-tts$/.test(model))' in tts


def test_tts_worker_cors_reflects_only_trusted_android_and_pages_origins():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")

    assert 'const TRUSTED_APP_ORIGINS=new Set([ORIGIN,"http://localhost","https://localhost","http://127.0.0.1","https://127.0.0.1","capacitor://localhost","ionic://localhost","https://appassets.androidplatform.net"]);' in worker
    assert "function isAllowedOrigin(origin)" in worker
    assert "function withRequestCors(response,request)" in worker
    assert 'responseHeaders.set("Access-Control-Allow-Origin",origin)' in worker
    assert 'if(!isAllowedOrigin(origin))return reply({error:"origin_not_allowed",origin},403);' in worker
    assert "return withRequestCors(response,request);" in worker
