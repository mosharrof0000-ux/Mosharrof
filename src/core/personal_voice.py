"""Consent-first domain contract for per-user personal voice profiles.

This module deliberately does not store audio, authenticate users, train models,
or expose HTTP endpoints. Those require a verified identity provider, private
object storage, and a model-serving host. Callers must pass the authenticated
owner ID and enforce ownership at every storage/API boundary.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional
from uuid import uuid4

SampleSource = Literal[
    "voice_setup",
    "user_selected_recording",
    "user_selected_transcription",
]


class VoicePolicyError(ValueError):
    """Raised when an operation violates voice consent or ownership policy."""


@dataclass(frozen=True)
class VoiceConsent:
    """Independent, revocable consent controls; all default to off."""

    clone_for_speech: bool = False
    use_selected_samples_to_improve: bool = False
    allow_model_training: bool = False


@dataclass(frozen=True)
class VoiceSample:
    """Metadata only; audio_ref must point to private, owner-scoped storage."""

    sample_id: str
    owner_id: str
    audio_ref: str
    transcript: str
    source: SampleSource
    user_approved: bool
    quality_status: Literal["pending", "accepted", "rejected"] = "pending"


@dataclass
class PersonalVoiceProfile:
    """One user's isolated voice profile, independent of the TTS provider."""

    owner_id: str
    display_name: str = "আমার কণ্ঠ"
    profile_id: str = field(default_factory=lambda: str(uuid4()))
    consent: VoiceConsent = field(default_factory=VoiceConsent)
    samples: dict[str, VoiceSample] = field(default_factory=dict)
    active_voice_version: Optional[str] = None
    preferred_engine: str = "gemini"
    deleted: bool = False

    @classmethod
    def create(
        cls,
        *,
        authenticated_owner_id: str,
        display_name: str = "আমার কণ্ঠ",
        consent: VoiceConsent,
    ) -> "PersonalVoiceProfile":
        if not authenticated_owner_id or not authenticated_owner_id.strip():
            raise VoicePolicyError("AUTHENTICATED_OWNER_REQUIRED")
        if not consent.clone_for_speech:
            raise VoicePolicyError("VOICE_CLONING_CONSENT_REQUIRED")
        return cls(
            owner_id=authenticated_owner_id,
            display_name=display_name.strip() or "আমার কণ্ঠ",
            consent=consent,
        )

    def assert_owner(self, authenticated_owner_id: str) -> None:
        if self.deleted:
            raise VoicePolicyError("VOICE_PROFILE_DELETED")
        if not authenticated_owner_id or authenticated_owner_id != self.owner_id:
            raise VoicePolicyError("VOICE_PROFILE_OWNER_MISMATCH")

    def register_sample(
        self,
        *,
        authenticated_owner_id: str,
        audio_ref: str,
        transcript: str,
        source: SampleSource,
        user_approved: bool,
    ) -> VoiceSample:
        """Register a deliberately selected sample; never auto-ingest raw audio."""
        self.assert_owner(authenticated_owner_id)
        if not self.consent.clone_for_speech:
            raise VoicePolicyError("VOICE_CLONING_CONSENT_REVOKED")
        if not self.consent.use_selected_samples_to_improve:
            raise VoicePolicyError("SAMPLE_IMPROVEMENT_CONSENT_REQUIRED")
        if not user_approved:
            raise VoicePolicyError("SAMPLE_APPROVAL_REQUIRED")
        if not audio_ref or not audio_ref.strip():
            raise VoicePolicyError("PRIVATE_AUDIO_REFERENCE_REQUIRED")
        if not transcript or not transcript.strip():
            raise VoicePolicyError("VERIFIED_TRANSCRIPT_REQUIRED")
        sample = VoiceSample(
            sample_id=str(uuid4()),
            owner_id=self.owner_id,
            audio_ref=audio_ref,
            transcript=transcript.strip(),
            source=source,
            user_approved=True,
        )
        self.samples[sample.sample_id] = sample
        return sample

    def set_sample_quality(
        self,
        *,
        authenticated_owner_id: str,
        sample_id: str,
        quality_status: Literal["accepted", "rejected"],
    ) -> VoiceSample:
        self.assert_owner(authenticated_owner_id)
        sample = self.samples.get(sample_id)
        if sample is None:
            raise VoicePolicyError("VOICE_SAMPLE_NOT_FOUND")
        updated = VoiceSample(
            sample_id=sample.sample_id,
            owner_id=sample.owner_id,
            audio_ref=sample.audio_ref,
            transcript=sample.transcript,
            source=sample.source,
            user_approved=sample.user_approved,
            quality_status=quality_status,
        )
        self.samples[sample_id] = updated
        return updated

    def activate_version(
        self,
        *,
        authenticated_owner_id: str,
        version_id: str,
        user_approved: bool,
    ) -> None:
        self.assert_owner(authenticated_owner_id)
        if not user_approved:
            raise VoicePolicyError("VOICE_VERSION_APPROVAL_REQUIRED")
        if not version_id or not version_id.strip():
            raise VoicePolicyError("VOICE_VERSION_REQUIRED")
        self.active_voice_version = version_id.strip()

    def revoke_sample_improvement(self, *, authenticated_owner_id: str) -> None:
        self.assert_owner(authenticated_owner_id)
        self.consent = VoiceConsent(
            clone_for_speech=self.consent.clone_for_speech,
            use_selected_samples_to_improve=False,
            allow_model_training=False,
        )

    def revoke_all_voice_use(self, *, authenticated_owner_id: str) -> list[str]:
        """Return private audio refs for the storage adapter to delete permanently."""
        self.assert_owner(authenticated_owner_id)
        refs = [sample.audio_ref for sample in self.samples.values()]
        self.samples.clear()
        self.active_voice_version = None
        self.consent = VoiceConsent()
        self.deleted = True
        return refs


ReadingStyle = Literal[
    "conversational", "poetry", "article", "news", "storytelling",
    "educational", "quran_recitation", "formal",
]
Emotion = Literal[
    "neutral", "warm", "joyful", "sad", "soothing", "dramatic", "confident"
]


class VoiceStyleError(ValueError):
    """Raised for invalid speech delivery settings."""


@dataclass(frozen=True)
class VoiceStyle:
    """Reading delivery preferences, independent of speaker identity."""

    reading_style: ReadingStyle = "conversational"
    speed: float = 1.0
    emotion: Emotion = "neutral"
    emotion_intensity: float = 0.35
    pitch: float = 0.0
    pause_scale: float = 1.0
    emphasis: float = 0.25

    def validate(self) -> "VoiceStyle":
        ranges = {
            "speed": (self.speed, 0.5, 2.0),
            "emotion_intensity": (self.emotion_intensity, 0.0, 1.0),
            "pitch": (self.pitch, -1.0, 1.0),
            "pause_scale": (self.pause_scale, 0.5, 2.0),
            "emphasis": (self.emphasis, 0.0, 1.0),
        }
        for name, (value, minimum, maximum) in ranges.items():
            if not minimum <= value <= maximum:
                raise VoiceStyleError(f"{name.upper()}_OUT_OF_RANGE")
        return self

    def to_provider_options(self, supported_controls: set[str]) -> dict[str, object]:
        """Send only controls explicitly supported by the chosen TTS provider."""
        self.validate()
        values: dict[str, object] = {
            "reading_style": self.reading_style,
            "speed": self.speed,
            "emotion": self.emotion,
            "emotion_intensity": self.emotion_intensity,
            "pitch": self.pitch,
            "pause_scale": self.pause_scale,
            "emphasis": self.emphasis,
        }
        return {key: value for key, value in values.items() if key in supported_controls}


STYLE_PRESETS: dict[str, VoiceStyle] = {
    "natural": VoiceStyle(),
    "poetry": VoiceStyle(reading_style="poetry", speed=0.88, emotion="warm",
                         emotion_intensity=0.55, pause_scale=1.35, emphasis=0.45),
    "article": VoiceStyle(reading_style="article", speed=1.0, emotion="neutral",
                          emotion_intensity=0.2, pause_scale=1.0, emphasis=0.3),
    "news": VoiceStyle(reading_style="news", speed=1.05, emotion="confident",
                       emotion_intensity=0.3, pause_scale=0.9, emphasis=0.45),
    "story": VoiceStyle(reading_style="storytelling", speed=0.92, emotion="warm",
                        emotion_intensity=0.65, pause_scale=1.25, emphasis=0.5),
    "study": VoiceStyle(reading_style="educational", speed=0.9, emotion="soothing",
                        emotion_intensity=0.25, pause_scale=1.2, emphasis=0.4),
    "quran": VoiceStyle(reading_style="quran_recitation", speed=0.85, emotion="soothing",
                        emotion_intensity=0.2, pause_scale=1.3, emphasis=0.25),
}
