from pathlib import Path


def test_tts_playback_failure_falls_back_even_when_audio_bytes_exist():
    html = Path("web/index.html").read_text(encoding="utf-8")
    start = html.index("function speakText(")
    end = html.index("function parseImageSpec(", start)
    speak = html[start:end]

    # Audio data is pushed into parts before audio.play() resolves. Its presence
    # therefore must not suppress fallback when the browser rejects playback.
    assert "parts.length===0&&myIdx===0" not in speak
    assert 'var fallbackText=chunks.slice(myIdx).join(" ").trim();' in speak
    assert 'speakWithBrowser(fallbackText,button);' in speak
    assert 'audio.play().catch(function(){throw new Error("audio_play_failed");});' in speak


def test_tts_download_button_is_only_added_after_completed_server_playback():
    html = Path("web/index.html").read_text(encoding="utf-8")
    start = html.index("function speakText(")
    end = html.index("function parseImageSpec(", start)
    speak = html[start:end]

    assert "function finishComplete()" in speak
    assert "showDownloadButton(button,combineAudioParts(parts,mime),mime)" in speak
    assert 'showDownloadButton(button,combineAudioParts(parts,mime),mime);' in speak
    assert 'speakWithBrowser(fallbackText,button);' in speak


def test_download_combines_wav_pcm_chunks_into_one_valid_wave_file():
    html = Path("web/index.html").read_text(encoding="utf-8")
    start = html.index("function combineAudioParts(")
    end = html.index("function splitSpeechChunks(", start)
    combine = html[start:end]

    assert 'mimeType.indexOf("wav")!==-1' in combine
    assert 'String.fromCharCode(part[0],part[1],part[2],part[3])!=="RIFF"' in combine
    assert 'wavView.setUint32(4,36+total,true)' in combine
    assert 'wavView.setUint32(40,total,true)' in combine


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


def test_tts_audio_uses_blob_url_for_mobile_playback_and_cleans_it_up():
    html = Path("web/index.html").read_text(encoding="utf-8")
    start = html.index("function speakText(")
    end = html.index("function parseImageSpec(", start)
    speak = html[start:end]

    assert 'var audioBlob=new Blob([audioBytes],{type:mime});' in speak
    assert 'var audioUrl=URL.createObjectURL(audioBlob);' in speak
    assert 'var audio=new Audio(audioUrl);' in speak
    assert 'URL.revokeObjectURL(audioUrl)' in speak
    assert 'URL.revokeObjectURL(activeAudioUrl)' in speak
