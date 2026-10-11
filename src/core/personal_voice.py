"""Consent-first domain layer for multi-user personal voice profiles.

This module intentionally does not provide HTTP routes, authentication, audio
persistence, or a model implementation. Production callers must inject a
trusted authenticated principal, a durable private audio store, and a reviewed
voice-cloning provider. No microphone/STT audio is enrolled implicitly.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from hashlib import sha256
from typing import Protocol
from uuid import uuid4


class VoicePermissionError(PermissionError):
    """The requested voice operation lacks explicit permission."""


class VoiceProfileNotFound(LookupError):
    """No profile exists for the authenticated user."""


class VoiceConfigurationError(RuntimeError):
    """A required private store or voice provider is unavailable."""


@dataclass(frozen=True)
class VoiceConsent:
    """Independent, revocable permissions; all default to disabled."""

    clone_enabled: bool = False
    profile_improvement_enabled: bool = False
    model_training_enabled: bool = False


@dataclass(frozen=True)
class VoiceSample:
    sample_id: str
    transcript: str
    audio_sha256: str
    source: str
    created_at: str
    approved_for_use: bool = True


@dataclass
class VoiceProfile:
    owner_id: str
    consent: VoiceConsent
    samples: list[VoiceSample] = field(default_factory=list)
    active_sample_id: str | None = None
    version: int = 1
    created_at: str = field(default_factory=lambda: _now())
    updated_at: str = field(default_factory=lambda: _now())


@dataclass(frozen=True)
class SynthesisResult:
    audio: bytes
    provider: str
    model: str


class VoiceProfileRepository(Protocol):
    """Repository implementations must scope every operation by owner_id."""

    def get(self, owner_id: str) -> VoiceProfile | None: ...
    def save(self, profile: VoiceProfile) -> None: ...
    def delete(self, owner_id: str) -> None: ...


class PrivateAudioStore(Protocol):
    """Production implementation must encrypt data at rest and isolate owners."""

    def put(self, owner_id: str, sample_id: str, audio: bytes) -> None: ...
    def get(self, owner_id: str, sample_id: str) -> bytes | None: ...
    def delete(self, owner_id: str, sample_id: str) -> None: ...


class VoiceCloneProvider(Protocol):
    name: str
    model: str

    def synthesize(self, text: str, reference_audio: bytes, reference_transcript: str) -> bytes: ...


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _validate_owner(owner_id: str) -> str:
    # This must be a stable ID supplied by the trusted authentication layer,
    # never a user-controlled form field or a client-selected profile ID.
    owner_id = (owner_id or "").strip()
    if not owner_id or len(owner_id) > 200:
        raise VoicePermissionError("A trusted authenticated owner ID is required")
    return owner_id


class PersonalVoiceService:
    """Consent-gated profile lifecycle, independent of any specific model."""

    MAX_SAMPLE_BYTES = 8 * 1024 * 1024
    MAX_TRANSCRIPT_CHARS = 2_000
    MAX_SYNTHESIS_CHARS = 4_000

    def __init__(
        self,
        repository: VoiceProfileRepository,
        audio_store: PrivateAudioStore,
        provider: VoiceCloneProvider | None = None,
    ) -> None:
        self.repository = repository
        self.audio_store = audio_store
        self.provider = provider

    def create_profile(
        self,
        *,
        owner_id: str,
        consent: VoiceConsent,
        voice_authorized: bool,
        sample_audio: bytes,
        sample_transcript: str,
    ) -> VoiceProfile:
        owner_id = _validate_owner(owner_id)
        if not voice_authorized:
            raise VoicePermissionError("The user must confirm they own this voice or have explicit permission")
        if not consent.clone_enabled:
            raise VoicePermissionError("Personal voice cloning consent is required")
        self._validate_sample(sample_audio, sample_transcript)
        if self.repository.get(owner_id) is not None:
            raise ValueError("A voice profile already exists for this user")
        sample_id = uuid4().hex
        sample = self._sample(sample_id, sample_audio, sample_transcript, "user_recorded_reference")
        profile = VoiceProfile(owner_id=owner_id, consent=consent, samples=[sample], active_sample_id=sample_id)
        self.audio_store.put(owner_id, sample_id, sample_audio)
        try:
            self.repository.save(profile)
        except Exception:
            self.audio_store.delete(owner_id, sample_id)
            raise
        return profile

    def add_approved_sample(
        self,
        *,
        owner_id: str,
        sample_audio: bytes,
        sample_transcript: str,
        source: str,
        user_explicitly_approved: bool,
    ) -> VoiceProfile:
        """Add a candidate sample; never auto-activate it or train model weights."""
        owner_id = _validate_owner(owner_id)
        profile = self._require_profile(owner_id)
        if not profile.consent.clone_enabled or not profile.consent.profile_improvement_enabled:
            raise VoicePermissionError("Voice cloning and profile-improvement consent must both be enabled")
        if not user_explicitly_approved:
            raise VoicePermissionError("Each improvement sample requires explicit user approval")
        if source not in {"manual_recording", "user_approved_transcription"}:
            raise ValueError("Unsupported voice sample source")
        self._validate_sample(sample_audio, sample_transcript)
        sample_id = uuid4().hex
        sample = self._sample(sample_id, sample_audio, sample_transcript, source)
        self.audio_store.put(owner_id, sample_id, sample_audio)
        try:
            profile.samples.append(sample)
            profile.version += 1
            profile.updated_at = _now()
            self.repository.save(profile)
        except Exception:
            self.audio_store.delete(owner_id, sample_id)
            raise
        return profile

    def activate_sample(self, *, owner_id: str, sample_id: str, user_approved: bool) -> VoiceProfile:
        owner_id = _validate_owner(owner_id)
        profile = self._require_profile(owner_id)
        if not user_approved:
            raise VoicePermissionError("Changing the active voice sample requires user approval")
        if not any(sample.sample_id == sample_id and sample.approved_for_use for sample in profile.samples):
            raise VoiceProfileNotFound("Approved sample not found in this user's profile")
        if self.audio_store.get(owner_id, sample_id) is None:
            raise VoiceConfigurationError("The private reference audio is unavailable")
        profile.active_sample_id = sample_id
        profile.version += 1
        profile.updated_at = _now()
        self.repository.save(profile)
        return profile

    def update_consent(self, *, owner_id: str, consent: VoiceConsent) -> VoiceProfile:
        owner_id = _validate_owner(owner_id)
        profile = self._require_profile(owner_id)
        profile.consent = consent
        profile.version += 1
        profile.updated_at = _now()
        if not consent.clone_enabled:
            profile.active_sample_id = None
        self.repository.save(profile)
        return profile

    def synthesize(self, *, owner_id: str, text: str) -> SynthesisResult:
        owner_id = _validate_owner(owner_id)
        profile = self._require_profile(owner_id)
        if not profile.consent.clone_enabled or not profile.active_sample_id:
            raise VoicePermissionError("Personal voice cloning is not enabled for this user")
        if self.provider is None:
            raise VoiceConfigurationError("No reviewed personal voice provider is configured")
        text = (text or "").strip()
        if not text or len(text) > self.MAX_SYNTHESIS_CHARS:
            raise ValueError("Text is empty or exceeds the synthesis limit")
        sample = next((s for s in profile.samples if s.sample_id == profile.active_sample_id), None)
        if sample is None:
            raise VoiceProfileNotFound("Active reference sample is missing")
        reference_audio = self.audio_store.get(owner_id, sample.sample_id)
        if not reference_audio:
            raise VoiceConfigurationError("Private reference audio is unavailable")
        audio = self.provider.synthesize(text, reference_audio, sample.transcript)
        if not isinstance(audio, bytes) or not audio:
            raise VoiceConfigurationError("Voice provider returned no audio")
        return SynthesisResult(audio=audio, provider=self.provider.name, model=self.provider.model)

    def delete_profile(self, *, owner_id: str, user_confirmed: bool) -> None:
        """Delete only the authenticated user's profile and its private samples."""
        owner_id = _validate_owner(owner_id)
        if not user_confirmed:
            raise VoicePermissionError("Profile deletion requires explicit confirmation")
        profile = self._require_profile(owner_id)
        for sample in profile.samples:
            self.audio_store.delete(owner_id, sample.sample_id)
        self.repository.delete(owner_id)

    def _require_profile(self, owner_id: str) -> VoiceProfile:
        profile = self.repository.get(owner_id)
        if profile is None:
            raise VoiceProfileNotFound("Personal voice profile not found")
        return profile

    @classmethod
    def _validate_sample(cls, audio: bytes, transcript: str) -> None:
        if not isinstance(audio, bytes) or not audio or len(audio) > cls.MAX_SAMPLE_BYTES:
            raise ValueError("Reference audio must be non-empty and at most 8 MiB")
        transcript = (transcript or "").strip()
        if not transcript or len(transcript) > cls.MAX_TRANSCRIPT_CHARS:
            raise ValueError("A matching reference transcript is required")

    @staticmethod
    def _sample(sample_id: str, audio: bytes, transcript: str, source: str) -> VoiceSample:
        return VoiceSample(
            sample_id=sample_id,
            transcript=transcript.strip(),
            audio_sha256=sha256(audio).hexdigest(),
            source=source,
            created_at=_now(),
        )
