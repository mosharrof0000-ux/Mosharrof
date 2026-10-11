import pytest

from src.core.personal_voice import (
    PersonalVoiceProfile, VoiceConsent, VoicePolicyError,
    STYLE_PRESETS, VoiceStyle, VoiceStyleError,
)


def consent(*, improve=False, train=False):
    return VoiceConsent(
        clone_for_speech=True,
        use_selected_samples_to_improve=improve,
        allow_model_training=train,
    )


def test_profile_requires_authenticated_owner_and_explicit_clone_consent():
    with pytest.raises(VoicePolicyError, match="AUTHENTICATED_OWNER_REQUIRED"):
        PersonalVoiceProfile.create(authenticated_owner_id="", consent=consent())
    with pytest.raises(VoicePolicyError, match="VOICE_CLONING_CONSENT_REQUIRED"):
        PersonalVoiceProfile.create(
            authenticated_owner_id="user-a", consent=VoiceConsent()
        )


def test_profile_rejects_another_users_access():
    profile = PersonalVoiceProfile.create(
        authenticated_owner_id="user-a", consent=consent(improve=True)
    )
    with pytest.raises(VoicePolicyError, match="VOICE_PROFILE_OWNER_MISMATCH"):
        profile.register_sample(
            authenticated_owner_id="user-b",
            audio_ref="private/user-a/sample.wav",
            transcript="আমি বাংলা বলছি।",
            source="user_selected_recording",
            user_approved=True,
        )


def test_samples_are_not_automatically_ingested_without_separate_opt_in():
    profile = PersonalVoiceProfile.create(
        authenticated_owner_id="user-a", consent=consent(improve=False)
    )
    with pytest.raises(VoicePolicyError, match="SAMPLE_IMPROVEMENT_CONSENT_REQUIRED"):
        profile.register_sample(
            authenticated_owner_id="user-a",
            audio_ref="private/user-a/sample.wav",
            transcript="আমি বাংলা বলছি।",
            source="user_selected_recording",
            user_approved=True,
        )


def test_sample_requires_user_approval_and_verified_transcript():
    profile = PersonalVoiceProfile.create(
        authenticated_owner_id="user-a", consent=consent(improve=True)
    )
    with pytest.raises(VoicePolicyError, match="SAMPLE_APPROVAL_REQUIRED"):
        profile.register_sample(
            authenticated_owner_id="user-a", audio_ref="private/user-a/sample.wav",
            transcript="আমি বাংলা বলছি।", source="voice_setup", user_approved=False,
        )
    with pytest.raises(VoicePolicyError, match="VERIFIED_TRANSCRIPT_REQUIRED"):
        profile.register_sample(
            authenticated_owner_id="user-a", audio_ref="private/user-a/sample.wav",
            transcript=" ", source="voice_setup", user_approved=True,
        )


def test_only_user_approved_voice_versions_can_be_activated():
    profile = PersonalVoiceProfile.create(
        authenticated_owner_id="user-a", consent=consent()
    )
    with pytest.raises(VoicePolicyError, match="VOICE_VERSION_APPROVAL_REQUIRED"):
        profile.activate_version(
            authenticated_owner_id="user-a", version_id="version-2", user_approved=False,
        )
    profile.activate_version(
        authenticated_owner_id="user-a", version_id="version-2", user_approved=True,
    )
    assert profile.active_voice_version == "version-2"


def test_revoke_improvement_disables_future_sample_ingestion():
    profile = PersonalVoiceProfile.create(
        authenticated_owner_id="user-a", consent=consent(improve=True, train=True)
    )
    profile.revoke_sample_improvement(authenticated_owner_id="user-a")
    assert not profile.consent.use_selected_samples_to_improve
    assert not profile.consent.allow_model_training


def test_revoke_all_voice_use_returns_refs_for_storage_deletion():
    profile = PersonalVoiceProfile.create(
        authenticated_owner_id="user-a", consent=consent(improve=True)
    )
    sample = profile.register_sample(
        authenticated_owner_id="user-a", audio_ref="private/user-a/sample.wav",
        transcript="আমি বাংলা বলছি।", source="voice_setup", user_approved=True,
    )
    refs = profile.revoke_all_voice_use(authenticated_owner_id="user-a")
    assert refs == [sample.audio_ref]
    assert profile.deleted
    assert not profile.samples
    assert profile.active_voice_version is None
    with pytest.raises(VoicePolicyError, match="VOICE_PROFILE_DELETED"):
        profile.assert_owner("user-a")


def test_speed_emotion_and_reading_style_are_independent_of_voice_identity():
    style = VoiceStyle(speed=1.35, emotion="joyful", emotion_intensity=0.8,
                       reading_style="poetry")
    assert style.validate().speed == 1.35
    assert style.emotion == "joyful"
    assert style.reading_style == "poetry"


@pytest.mark.parametrize("kwargs", [
    {"speed": 0.2}, {"speed": 2.1},
    {"emotion_intensity": -0.1}, {"emotion_intensity": 1.1},
    {"pitch": -1.1}, {"pitch": 1.1},
    {"pause_scale": 0.2}, {"pause_scale": 2.1},
    {"emphasis": -0.1}, {"emphasis": 1.1},
])
def test_invalid_style_values_are_rejected(kwargs):
    with pytest.raises(VoiceStyleError):
        VoiceStyle(**kwargs).validate()


def test_provider_receives_only_controls_it_claims_to_support():
    options = VoiceStyle(speed=1.2, reading_style="poetry").to_provider_options({"speed"})
    assert options == {"speed": 1.2}
    assert "reading_style" not in options


def test_presets_cover_common_reading_modes():
    assert {"natural", "poetry", "article", "news", "story", "study", "quran"} <= set(STYLE_PRESETS)
    assert STYLE_PRESETS["poetry"].pause_scale > STYLE_PRESETS["article"].pause_scale
