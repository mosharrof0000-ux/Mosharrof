"""Context-aware voice processing boundary for Mosharrof.

The engine deliberately separates:
- authorization to listen/record,
- transcript normalization,
- punctuation,
- conservative contextual correction.

It does not pretend to perform acoustic/ASR inference when no speech model is
attached. An ASR/model adapter can supply a transcript later without changing
the entity contract.
"""

import re
from typing import Any, Dict, Optional, Mapping
from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
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

    @staticmethod
    def apply_smart_punctuation(raw_text: str) -> str:
        """Apply conservative punctuation without changing the user's words."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        text = re.sub(r"\s+([,!?।])", r"\1", text)

        if text[-1] not in ".!?।":
            question_markers = (
                "কি", "কেন", "কীভাবে", "কোথায়", "কোথায়", "কখন",
                "কে", "কার", "কত", "হবে কি", "করব কি",
            )
            if any(marker in text for marker in question_markers):
                text += "?"
            else:
                text += "।"
        return text

    @staticmethod
    def correct_contextual_grammar(
        raw_text: str, context_terms: Optional[Mapping[str, str]] = None
    ) -> str:
        """Conservatively normalize transcript text using explicit context terms.

        No hidden dictionary or speculative rewrite is used. Callers/models can
        provide confirmed context mappings such as an ASR correction candidate.
        """
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text or not context_terms:
            return text

        for source, target in sorted(context_terms.items(), key=lambda item: -len(item[0])):
            if source and target:
                text = re.sub(re.escape(source), target, text, flags=re.IGNORECASE)
        return text

    @classmethod
    def process_transcript(
        cls, raw_text: str, context_terms: Optional[Mapping[str, str]] = None
    ) -> Dict[str, Any]:
        corrected = cls.correct_contextual_grammar(raw_text, context_terms)
        punctuated = cls.apply_smart_punctuation(corrected)
        return {
            "status": "SUCCESS" if punctuated else "EMPTY",
            "raw_text": raw_text or "",
            "corrected_text": corrected,
            "text": punctuated,
            "punctuation_applied": bool(punctuated),
            "context_correction_applied": corrected != (raw_text or "").strip(),
        }

    def sanitize_phonetic_speech(
        self, audio_stream: Any, context_terms: Optional[Mapping[str, str]] = None
    ) -> Dict[str, Any]:
        """Normalize a transcript supplied by an ASR adapter.

        Raw audio requires an external speech/ASR model and is intentionally not
        guessed here. This keeps the engine model-agnostic and auditable.
        """
        if isinstance(audio_stream, str):
            result = self.process_transcript(audio_stream, context_terms)
            result["input_mode"] = "TRANSCRIPT"
            return result
        return {
            "status": "MODEL_REQUIRED",
            "input_mode": "AUDIO",
            "reason": "Attach an approved speech/ASR model adapter before acoustic processing.",
        }

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        speaker_info = self.identify_speaker(speaker_signature)
        processed = self.process_transcript(transcript)
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", {
            "speaker": speaker_info["speaker"],
            "transcript": processed["text"],
            "is_known_person": speaker_info["is_known"],
            "privacy_status": "LOCAL_ONLY",
        })
        return {
            "status": "SUCCESS",
            "detected_speaker": speaker_info["speaker"],
            "is_known": speaker_info["is_known"],
            "transcript": processed["text"],
        }
