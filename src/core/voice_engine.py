"""Mosharrof context-aware voice journal engine.

The engine keeps recording authorization separate from transcript processing.
Audio-to-text remains provider/runtime specific; this module provides the
deterministic text intelligence layer that can be placed after any ASR model.
"""

import re
from typing import Any, Dict, Optional

from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    """Authorized voice boundary plus context-aware transcript processing."""

    _PHONETIC_REPLACEMENTS = {
        "কোরান": "কুরআন",
        "কুরান": "কুরআন",
        "কুরআন রিসার্চ": "কুরআন গবেষণা",
        "মশাররফ": "মোশাররফ",
        "মোশররফ": "মোশাররফ",
    }

    _CONTEXT_REPLACEMENTS = {
        "কুরআন গবেষনা": "কুরআন গবেষণা",
        "গবেষনা": "গবেষণা",
        "প্রজেক্টে": "প্রজেক্টে",
        "মোশারফ প্রজেক্ট": "মোশাররফ প্রজেক্ট",
    }

    _QUESTION_STARTERS = (
        "কি", "কী", "কেন", "কিভাবে", "কীভাবে", "কোথায়", "কোথায়",
        "কখন", "কে", "কোন", "কোনটি", "হবে কি",
    )

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

    def apply_smart_punctuation(self, raw_text: str) -> str:
        """Add conservative Bengali punctuation without rewriting meaning."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""

        text = re.sub(r"\s+([,।?!])", r"\1", text)
        text = re.sub(r"([,।?!])(?=\S)", r"\1 ", text)
        if text.endswith((",", "।", "?", "!")):
            return text

        first_word = text.split(" ", 1)[0].lower()
        if first_word in self._QUESTION_STARTERS or text.endswith(("কি", "কী")):
            return text + "?"
        return text + "।"

    def correct_contextual_grammar(self, raw_text: str) -> str:
        """Apply only high-confidence, project-specific text corrections."""
        text = (raw_text or "").strip()
        if not text:
            return ""

        for source, target in self._CONTEXT_REPLACEMENTS.items():
            text = text.replace(source, target)

        # Normalize repeated whitespace while preserving user word order.
        return re.sub(r"\s+", " ", text).strip()

    def sanitize_phonetic_speech(self, audio_stream: Any) -> str:
        """Normalize a transcript-like input using conservative phonetic rules.

        This function does not pretend to perform ASR. Bytes/opaque audio must
        first be transcribed by an external ASR model, then passed here.
        """
        if isinstance(audio_stream, dict):
            text = audio_stream.get("transcript", "")
        elif isinstance(audio_stream, str):
            text = audio_stream
        else:
            return ""

        text = text.strip()
        for source, target in self._PHONETIC_REPLACEMENTS.items():
            text = text.replace(source, target)
        return re.sub(r"\s+", " ", text).strip()

    def process_voice_text(self, raw_text: str) -> Dict[str, Any]:
        """Run the deterministic voice-text pipeline in a stable order."""
        sanitized = self.sanitize_phonetic_speech(raw_text)
        corrected = self.correct_contextual_grammar(sanitized)
        punctuated = self.apply_smart_punctuation(corrected)
        result = {
            "status": "SUCCESS" if punctuated else "EMPTY",
            "raw_text": raw_text or "",
            "sanitized_text": sanitized,
            "corrected_text": corrected,
            "text": punctuated,
            "pipeline": [
                "phonetic_sanitizer",
                "contextual_correction",
                "smart_punctuation",
            ],
        }
        self.ledger.record_event("VOICE_TEXT_PROCESSED", result)
        return result

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}

        processed = self.process_voice_text(transcript)
        speaker_info = self.identify_speaker(speaker_signature)
        self.ledger.record_event(
            "SOCIAL_INTERACTION_LOGGED",
            {
                "speaker": speaker_info["speaker"],
                "transcript": processed["text"],
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
