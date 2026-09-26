"""Mosharrof context-aware voice engine.

The engine keeps recording authorization separate from text intelligence.
It can normalize a transcript, inject conservative punctuation, and apply
only high-confidence contextual corrections. Audio-to-text itself remains a
provider/runtime responsibility; this module never pretends to transcribe
audio without a speech provider.
"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional

from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    """Voice input boundary plus conservative context-aware transcript cleanup."""

    COMMON_BANGLA_CORRECTIONS = {
        "কোরআন": "কুরআন",
        "কুরান": "কুরআন",
        "কোরান": "কুরআন",
        "মোশারফ": "মোশাররফ",
    }

    def __init__(self, memory_ledger: Optional[MemoryLedger] = None):
        self.ledger = memory_ledger or MemoryLedger()
        self.is_listening = False
        self.recording_authorized = False
        self.known_voices: Dict[str, str] = {}

    def toggle_listening(self, state: bool, authorized: bool = False) -> Dict[str, Any]:
        if state and not authorized:
            self.is_listening = False
            self.recording_authorized = False
            return {
                "listening_state": "BLOCKED",
                "recording_authorized": False,
                "reason": "EXPLICIT_AUTHORIZATION_REQUIRED",
            }
        self.is_listening = state
        self.recording_authorized = state and authorized
        return {
            "listening_state": "ACTIVE" if self.is_listening else "INACTIVE",
            "recording_authorized": self.recording_authorized,
        }

    def identify_speaker(self, voice_signature: str) -> Dict[str, Any]:
        if voice_signature in self.known_voices:
            return {"is_known": True, "speaker": self.known_voices[voice_signature]}
        return {"is_known": False, "speaker": "UNKNOWN_VOICE"}

    @classmethod
    def correct_contextual_grammar(cls, raw_text: str) -> str:
        """Apply only explicit, high-confidence lexical corrections."""
        text = (raw_text or "").strip()
        if not text:
            return ""
        for wrong, right in cls.COMMON_BANGLA_CORRECTIONS.items():
            text = re.sub(rf"(?<!\S){re.escape(wrong)}(?!\S)", right, text)
        text = re.sub(r"[ \t]+", " ", text)
        return text

    @classmethod
    def apply_smart_punctuation(cls, raw_text: str) -> str:
        """Add conservative punctuation from transcript structure.

        Real pause/intonation metadata can be supplied by a speech runtime.
        Plain text alone is never treated as proof of prosody.
        """
        text = cls.correct_contextual_grammar(raw_text)
        if not text:
            return ""

        text = re.sub(r"\s+([,।?!])", r"\1", text)
        text = re.sub(r"([,।?!])(?=\S)", r"\1 ", text)

        question_starts = (
            "কি ", "কেন ", "কী ", "কোথায় ", "কোথায় ", "কখন ",
            "কিভাবে ", "কীভাবে ", "কে ", "কোন ", "কত ",
        )
        if not text.endswith(("।", "?", "!", "…")):
            text += "?" if text.startswith(question_starts) else "।"
        return text

    @classmethod
    def sanitize_phonetic_speech(cls, audio_stream: Any) -> Dict[str, Any]:
        """Normalize an already-produced transcript.

        Raw audio requires a speech-to-text provider and is deliberately not
        guessed here. Pass transcript text to get a deterministic result.
        """
        if isinstance(audio_stream, str):
            normalized = cls.apply_smart_punctuation(audio_stream)
            return {
                "status": "SUCCESS",
                "input_type": "TRANSCRIPT_TEXT",
                "text": normalized,
                "provider_required": False,
            }
        return {
            "status": "PROVIDER_REQUIRED",
            "input_type": type(audio_stream).__name__,
            "reason": "RAW_AUDIO_REQUIRES_SPEECH_TO_TEXT_PROVIDER",
            "provider_required": True,
        }

    def process_transcript(self, raw_text: str) -> Dict[str, Any]:
        """Run the complete conservative transcript pipeline."""
        original = (raw_text or "").strip()
        normalized = self.correct_contextual_grammar(original)
        punctuated = self.apply_smart_punctuation(normalized)
        result = {
            "status": "SUCCESS" if punctuated else "EMPTY",
            "original_text": original,
            "normalized_text": normalized,
            "text": punctuated,
            "pipeline": [
                "contextual_high_confidence_correction",
                "smart_punctuation",
            ],
        }
        if punctuated:
            self.ledger.record_event("VOICE_TRANSCRIPT_PROCESSED", result)
        return result

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}

        processed = self.process_transcript(transcript)
        speaker_info = self.identify_speaker(speaker_signature)
        self.ledger.record_event(
            "SOCIAL_INTERACTION_LOGGED",
            {
                "speaker": speaker_info["speaker"],
                "transcript": processed["text"],
                "original_transcript": transcript,
                "is_known_person": speaker_info["is_known"],
                "privacy_status": "LOCAL_ONLY",
            },
        )
        return {
            "status": "SUCCESS",
            "detected_speaker": speaker_info["speaker"],
            "is_known": speaker_info["is_known"],
            "transcript": processed["text"],
        }
