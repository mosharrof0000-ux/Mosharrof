import pytest

from src.core.voice_style import (
    STYLE_DEFAULTS,
    VoiceDeliverySettings,
    VoiceStyleError,
)


def test_presets_cover_requested_reading_styles():
    assert {"natural", "article", "news", "storytelling", "poetry", "lesson",
            "presentation", "calm"} <= set(STYLE_DEFAULTS)
    assert VoiceDeliverySettings.for_style("poetry").speed < 1.0
    assert VoiceDeliverySettings.for_style("article").emotion_intensity < 30


def test_speed_and_emotion_are_independently_adjustable():
    original = VoiceDeliverySettings.for_style("poetry")
    faster = original.with_speed(1.2)
    assert faster.speed == 1.2
    assert faster.emotion_intensity == original.emotion_intensity
    more_emotional = faster.with_emotion(90)
    assert more_emotional.speed == 1.2
    assert more_emotional.emotion_intensity == 90
    assert more_emotional.style == "poetry"


@pytest.mark.parametrize("speed", [0.74, 1.51])
def test_rejects_speed_out_of_range(speed):
    with pytest.raises(VoiceStyleError, match="SPEED_OUT_OF_RANGE"):
        VoiceDeliverySettings(speed=speed)


@pytest.mark.parametrize("emotion", [-1, 101])
def test_rejects_emotion_out_of_range(emotion):
    with pytest.raises(VoiceStyleError, match="EMOTION_INTENSITY_OUT_OF_RANGE"):
        VoiceDeliverySettings(emotion_intensity=emotion)


def test_style_does_not_change_voice_identity_contract():
    # Delivery settings have no speaker/profile field by design.
    settings = VoiceDeliverySettings.for_style("poetry")
    assert not hasattr(settings, "owner_id")
    assert not hasattr(settings, "profile_id")
