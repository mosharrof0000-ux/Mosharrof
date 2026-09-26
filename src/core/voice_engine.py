"""Context-aware voice journal engine for Mosharrof.

The engine keeps recording authorization explicit and adds a deterministic
post-transcription layer for smart punctuation, conservative contextual
correction, and phonetic/text sanitization. Raw microphone DSP is intentionally
outside this module; a speech-to-text provider can feed its transcript here.
"""

import re
from typing import Any, Dict, Iterable, Optional

from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    _COMMON_CONTEXT_FIXES = {
        "কোরান": "কুরআন",
        "কোরআন": "কুরআন",
        "কুরান": "কুরআন",
        "মশাররফ": "মোশাররফ",
    }

    _QUESTION_STARTERS = (
        "কি", "কী", "কেন", "কিভাবে", "কীভাবে", "কোথায়", "কোথায়",
        "কখন", "কে", "কোন", "কোনটি", "what", "why", "how", "where",
        "when", "who", "which",
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

    @classmethod
    def apply_smart_punctuation(cls, raw_text: str) -> str:
        """Add conservative sentence punctuation without rewriting the words."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""

        # Preserve existing sentence punctuation and normalize spacing.
        text = re.sub(r"\s+([,!?।])", r"\1", text)
        text = re.sub(r",(?=\S)", ", ", text)

        if text[-1] in ".!?।":
            return text

        first_word = text.split(maxsplit=1)[0].strip(" ,.!?।").lower()
        if first_word in cls._QUESTION_STARTERS:
            return text + "?"
        return text + "।"

    @classmethod
    def correct_contextual_grammar(
        cls, raw_text: str, context: Optional[Dict[str, Any]] = None
    ) -> str:
        """Apply only conservative, configured corrections with context hints."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""

        context = context or {}
        custom = context.get("corrections", {})
        corrections = dict(cls._COMMON_CONTEXT_FIXES)
        if isinstance(custom, dict):
            corrections.update(
                {str(k): str(v) for k, v in custom.items() if str(k).strip()}
            )

        for wrong, right in sorted(corrections.items(), key=lambda item: -len(item[0])):
            text = re.sub(
                rf"(?<!\S){re.escape(wrong)}(?!\S)",
                right,
                text,
                flags=re.IGNORECASE if wrong.isascii() else 0,
            )
        return text

    @classmethod
    def sanitize_phonetic_speech(cls, audio_stream: Any) -> Dict[str, Any]:
        """Sanitize a speech-to-text transcript; raw audio DSP belongs to an STT adapter.

        If a text transcript is supplied, it is normalized and corrected. Binary
        microphone/audio frames are rejected rather than being falsely treated as text.
        """
        if isinstance(audio_stream, bytes):
            return {
                "status": "UNSUPPORTED_AUDIO_PAYLOAD",
                "reason": "RAW_AUDIO_REQUIRES_SPEECH_TO_TEXT_ADAPTER",
            }
        if not isinstance(audio_stream, str):
            return {"status": "INVALID_INPUT", "reason": "TEXT_TRANSCRIPT_REQUIRED"}

        normalized = cls.correct_contextual_grammar(audio_stream)
        punctuated = cls.apply_smart_punctuation(normalized)
        return {
            "status": "SUCCESS",
            "input": audio_stream,
            "text": punctuated,
            "transformations": [
                "contextual_correction",
                "smart_punctuation",
                "phonetic_text_sanitization",
            ],
        }

    def process_transcript(
        self, transcript: str, context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        corrected = self.correct_contextual_grammar(transcript, context)
        punctuated = self.apply_smart_punctuation(corrected)
        result = {
            "status": "SUCCESS" if punctuated else "EMPTY",
            "raw_text": transcript,
            "text": punctuated,
            "smart_punctuation": True,
            "contextual_correction": corrected != (transcript or "").strip(),
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
