from pathlib import Path


def test_speech_to_text_controls_remain_in_the_voice_family():
    html = Path("web/index.html").read_text(encoding="utf-8")
    voice_family_start = html.index('<span>Voice & interaction</span>')
    voice_family_end = html.index("'</div></section></div>;", voice_family_start)
    voice_family = html[voice_family_start:voice_family_end]

    assert 'id="voiceBtn"' in voice_family
    assert 'id="sttLanguageSelect"' in voice_family
    assert 'value="bn-BD"' in voice_family
    assert 'value="en-US"' in voice_family


def test_speech_to_text_runs_continuously_for_songs_and_restarts_after_gaps():
    html = Path("web/index.html").read_text(encoding="utf-8")

    assert "window.SpeechRecognition||window.webkitSpeechRecognition" in html
    assert "function startV()" in html
    assert "rec.continuous=true" in html
    assert "voiceWanted&&!voiceFatalError" in html
    assert "voiceRestartTimer=setTimeout" in html
    assert "গান গাইতে থাকুন" in html
    assert 'aria-live="polite"' in html
    assert "setVoiceButtonState(true)" in html
    assert "setVoiceButtonState(false)" in html


def test_speech_to_text_improves_phrase_joining_and_final_punctuation():
    html = Path("web/index.html").read_text(encoding="utf-8")

    assert "function voiceAddPhrase(value)" in html
    assert "voiceFinalTranscript+=" in html
    assert "function finishVoiceTranscript()" in html
    assert 'value.replace(/[,，;；:]+$/,"")+"।"' in html


def test_speech_to_text_handles_browser_errors_and_keeps_manual_chat():
    html = Path("web/index.html").read_text(encoding="utf-8")

    for code in (
        "not-allowed",
        "no-speech",
        "audio-capture",
        "network",
        "language-not-supported",
    ):
        assert code in html
    assert "টাইপ করে পাঠান" in html
    assert 'function send()' in html
    assert "function coreReply(" in html
