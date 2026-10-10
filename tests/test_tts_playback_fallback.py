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
