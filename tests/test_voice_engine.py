from src.core.voice_engine import VoiceJournalEngine

def test_smart_punctuation():
    engine = VoiceJournalEngine()
    assert engine.apply_smart_punctuation('আজ আমরা কোথায় যাব') == 'আজ আমরা কোথায় যাব?'
    assert engine.apply_smart_punctuation('আজ গবেষণা শুরু করি') == 'আজ গবেষণা শুরু করি।'

def test_contextual_correction():
    engine = VoiceJournalEngine()
    assert engine.correct_contextual_grammar('মশারফ কোরআন গবেষণা করবে') == 'মোশাররফ কুরআন গবেষণা করবে।'

def test_provider_boundary_for_speech():
    engine = VoiceJournalEngine()
    assert engine.sanitize_phonetic_speech(transcript='hello')['status'] == 'BLOCKED'
    engine.toggle_listening(True, authorized=True)
    result = engine.sanitize_phonetic_speech(transcript='আজ আমরা কোথায় যাব')
    assert result['status'] == 'SUCCESS'
    assert result['normalized_text'].endswith('?')