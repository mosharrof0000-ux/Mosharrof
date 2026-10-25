from copy import deepcopy

import pytest

from src.core.personal_voice import (
    PersonalVoiceService,
    VoiceConsent,
    VoicePermissionError,
    VoiceProfileNotFound,
)


class MemoryRepo:
    def __init__(self):
        self.profiles = {}

    def get(self, owner_id):
        profile = self.profiles.get(owner_id)
        return deepcopy(profile) if profile else None

    def save(self, profile):
        self.profiles[profile.owner_id] = deepcopy(profile)

    def delete(self, owner_id):
        self.profiles.pop(owner_id, None)


class PrivateAudio:
    def __init__(self):
        self.items = {}

    def put(self, owner_id, sample_id, audio):
        self.items[(owner_id, sample_id)] = audio

    def get(self, owner_id, sample_id):
        return self.items.get((owner_id, sample_id))

    def delete(self, owner_id, sample_id):
        self.items.pop((owner_id, sample_id), None)


class FakeProvider:
    name = "test-provider"
    model = "test-model"

    def synthesize(self, text, reference_audio, reference_transcript):
        assert reference_audio == b"owner voice"
        assert reference_transcript == "আমি মোশাররফ"
        return ("audio:" + text).encode()


def make_service(provider=None):
    repo, audio = MemoryRepo(), PrivateAudio()
    return PersonalVoiceService(repo, audio, provider), repo, audio


def test_profile_creation_requires_voice_permission_and_explicit_clone_consent():
    service, _, _ = make_service()
    with pytest.raises(VoicePermissionError):
        service.create_profile(
            owner_id="user-a", consent=VoiceConsent(clone_enabled=True),
            voice_authorized=False, sample_audio=b"voice", sample_transcript="কথা",
        )
    with pytest.raises(VoicePermissionError):
        service.create_profile(
            owner_id="user-a", consent=VoiceConsent(),
            voice_authorized=True, sample_audio=b"voice", sample_transcript="কথা",
        )


def test_profiles_and_audio_are_isolated_by_owner():
    service, repo, audio = make_service()
    profile = service.create_profile(
        owner_id="user-a", consent=VoiceConsent(clone_enabled=True),
        voice_authorized=True, sample_audio=b"owner voice", sample_transcript="আমি মোশাররফ",
    )
    assert repo.get("user-a").owner_id == "user-a"
    assert repo.get("user-b") is None
    assert audio.get("user-a", profile.active_sample_id) == b"owner voice"
    assert audio.get("user-b", profile.active_sample_id) is None


def test_synthesis_uses_only_the_active_users_approved_reference_sample():
    service, _, _ = make_service(FakeProvider())
    profile = service.create_profile(
        owner_id="user-a", consent=VoiceConsent(clone_enabled=True),
        voice_authorized=True, sample_audio=b"owner voice", sample_transcript="আমি মোশাররফ",
    )
    result = service.synthesize(owner_id="user-a", text="বাংলায় উত্তর")
    assert result.audio == "audio:বাংলায় উত্তর".encode()
    assert result.provider == "test-provider"
    assert result.model == "test-model"
    with pytest.raises(VoiceProfileNotFound):
        service.synthesize(owner_id="user-b", text="অন্য ব্যবহারকারী")


def test_new_samples_require_separate_improvement_consent_and_approval():
    service, _, _ = make_service()
    service.create_profile(
        owner_id="user-a", consent=VoiceConsent(clone_enabled=True),
        voice_authorized=True, sample_audio=b"owner voice", sample_transcript="আমি মোশাররফ",
    )
    with pytest.raises(VoicePermissionError):
        service.add_approved_sample(
            owner_id="user-a", sample_audio=b"next sample", sample_transcript="নতুন কথা",
            source="user_approved_transcription", user_explicitly_approved=True,
        )
    service.update_consent(
        owner_id="user-a",
        consent=VoiceConsent(clone_enabled=True, profile_improvement_enabled=True),
    )
    with pytest.raises(VoicePermissionError):
        service.add_approved_sample(
            owner_id="user-a", sample_audio=b"next sample", sample_transcript="নতুন কথা",
            source="user_approved_transcription", user_explicitly_approved=False,
        )
    profile = service.add_approved_sample(
        owner_id="user-a", sample_audio=b"next sample", sample_transcript="নতুন কথা",
        source="user_approved_transcription", user_explicitly_approved=True,
    )
    assert len(profile.samples) == 2
    assert profile.active_sample_id == profile.samples[0].sample_id


def test_candidate_sample_is_not_activated_until_user_approves_it():
    service, _, _ = make_service()
    profile = service.create_profile(
        owner_id="user-a",
        consent=VoiceConsent(clone_enabled=True, profile_improvement_enabled=True),
        voice_authorized=True, sample_audio=b"owner voice", sample_transcript="আমি মোশাররফ",
    )
    old_active = profile.active_sample_id
    profile = service.add_approved_sample(
        owner_id="user-a", sample_audio=b"new voice sample", sample_transcript="আরেকটি কথা",
        source="manual_recording", user_explicitly_approved=True,
    )
    candidate = profile.samples[-1]
    assert profile.active_sample_id == old_active
    with pytest.raises(VoicePermissionError):
        service.activate_sample(owner_id="user-a", sample_id=candidate.sample_id, user_approved=False)
    profile = service.activate_sample(owner_id="user-a", sample_id=candidate.sample_id, user_approved=True)
    assert profile.active_sample_id == candidate.sample_id


def test_deletion_is_explicit_and_only_removes_the_selected_owner():
    service, repo, audio = make_service()
    profile_a = service.create_profile(
        owner_id="user-a", consent=VoiceConsent(clone_enabled=True),
        voice_authorized=True, sample_audio=b"owner voice", sample_transcript="আমি মোশাররফ",
    )
    profile_b = service.create_profile(
        owner_id="user-b", consent=VoiceConsent(clone_enabled=True),
        voice_authorized=True, sample_audio=b"other voice", sample_transcript="অন্য ব্যবহারকারী",
    )
    with pytest.raises(VoicePermissionError):
        service.delete_profile(owner_id="user-a", user_confirmed=False)
    service.delete_profile(owner_id="user-a", user_confirmed=True)
    assert repo.get("user-a") is None
    assert repo.get("user-b") is not None
    assert audio.get("user-a", profile_a.active_sample_id) is None
    assert audio.get("user-b", profile_b.active_sample_id) == b"other voice"


def test_invalid_sample_and_unconfigured_provider_fail_closed():
    service, _, _ = make_service()
    with pytest.raises(ValueError):
        service.create_profile(
            owner_id="user-a", consent=VoiceConsent(clone_enabled=True),
            voice_authorized=True, sample_audio=b"", sample_transcript="কথা",
        )
    service.create_profile(
        owner_id="user-a", consent=VoiceConsent(clone_enabled=True),
        voice_authorized=True, sample_audio=b"owner voice", sample_transcript="আমি মোশাররফ",
    )
    with pytest.raises(Exception):
        service.synthesize(owner_id="user-a", text="বাংলা")
