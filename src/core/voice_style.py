"""Validated delivery-style preferences, independent of voice identity.

These settings describe user intent; provider adapters must map only capabilities
actually supported by the selected TTS engine.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ReadingStyle = Literal[
    "natural",
    "article",
    "news",
    "storytelling",
    "poetry",
    "lesson",
    "presentation",
    "calm",
]

STYLE_DEFAULTS: dict[str, tuple[float, int, float]] = {
    # speed multiplier, emotion intensity (0-100), paragraph pause seconds
    "natural": (1.0, 25, 0.35),
    "article": (0.98, 10, 0.45),
    "news": (1.0, 5, 0.30),
    "storytelling": (0.95, 55, 0.55),
    "poetry": (0.88, 65, 0.80),
    "lesson": (0.92, 20, 0.65),
    "presentation": (0.95, 30, 0.60),
    "calm": (0.85, 20, 0.75),
}


class VoiceStyleError(ValueError):
    """Raised when voice delivery settings are outside supported bounds."""


@dataclass(frozen=True)
class VoiceDeliverySettings:
    """User-adjustable delivery settings; never identifies or trains a speaker."""

    style: ReadingStyle = "natural"
    speed: float = 1.0
    emotion_intensity: int = 25
    paragraph_pause_seconds: float = 0.35
    emphasis_enabled: bool = True

    def __post_init__(self) -> None:
        if self.style not in STYLE_DEFAULTS:
            raise VoiceStyleError("UNSUPPORTED_READING_STYLE")
        if not 0.75 <= self.speed <= 1.5:
            raise VoiceStyleError("SPEED_OUT_OF_RANGE")
        if not 0 <= self.emotion_intensity <= 100:
            raise VoiceStyleError("EMOTION_INTENSITY_OUT_OF_RANGE")
        if not 0.0 <= self.paragraph_pause_seconds <= 2.0:
            raise VoiceStyleError("PARAGRAPH_PAUSE_OUT_OF_RANGE")

    @classmethod
    def for_style(cls, style: ReadingStyle) -> "VoiceDeliverySettings":
        if style not in STYLE_DEFAULTS:
            raise VoiceStyleError("UNSUPPORTED_READING_STYLE")
        speed, emotion, pause = STYLE_DEFAULTS[style]
        return cls(
            style=style,
            speed=speed,
            emotion_intensity=emotion,
            paragraph_pause_seconds=pause,
        )

    def with_speed(self, speed: float) -> "VoiceDeliverySettings":
        return VoiceDeliverySettings(
            style=self.style,
            speed=speed,
            emotion_intensity=self.emotion_intensity,
            paragraph_pause_seconds=self.paragraph_pause_seconds,
            emphasis_enabled=self.emphasis_enabled,
        )

    def with_emotion(self, intensity: int) -> "VoiceDeliverySettings":
        return VoiceDeliverySettings(
            style=self.style,
            speed=self.speed,
            emotion_intensity=intensity,
            paragraph_pause_seconds=self.paragraph_pause_seconds,
            emphasis_enabled=self.emphasis_enabled,
        )
