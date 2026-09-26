"""Context-aware voice journal processing with explicit authorization.

This module deliberately separates text normalization from audio/ASR. The core
cannot manufacture speech recognition from raw audio; an upstream ASR component
must provide text or a compatible transcript stream.
"""

import re
from typing import Any, Dict, Optional, Union

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
        """Add conservative Bengali/English punctuation without changing words.

        This is intentionally deterministic. A future ASR/model adapter may pass
        richer pause/intonation metadata, but this function never invents words.
        """
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        text = re.sub(r"\s+([,।!?])", r"\1", text)
        if text.endswith(("।", "!", "?", ",")):
            return text
        # Explicit question forms get a question mark; otherwise finish a sentence.
        question_starters = (
            "কি ", "কী ", "কেন ", "কিভাবে ", "কীভাবে ", "কোথায় ", "কোথায় ",
            "কখন ", "কে ", "what ", "why ", "how ", "where ", "when ", "who ",
        )
        if text.lower().startswith(question_starters):
            return text + "?"
        return text + "।"

    @staticmethod
    def correct_contextual_grammar(raw_text: str) -> Dict[str, Any]:
        """Apply only high-confidence, context-safe normalization.

        The method returns both original and corrected text so an upstream AI
        entity can audit or reject a correction. It does not claim to perform
        full ASR or grammar understanding.
        """
        original = re.sub(r"\s+", " ", (raw_text or "").strip())
        corrected = original
        replacements = {
            "মোশারফ প্রজেক্ট": "মোশাররফ প্রজেক্ট",
            "মোশারফ এর": "মোশাররফের",
            "মোশারফ এরটা": "মোশাররফেরটা",
        }
        for wrong, right in replacements.items():
            corrected = corrected.replace(wrong, right)
        return {
            "original": original,
            "corrected": corrected,
            "changed": corrected != original,
            "confidence": 1.0 if corrected != original else 0.0,
            "method": "HIGH_CONFIDENCE_CONTEXT_RULES",
        }

    @staticmethod
    def sanitize_phonetic_speech(audio_stream: Union[str, bytes, bytearray]) -> Dict[str, Any]:
        """Normalize a transcript-like stream.

        Raw audio bytes are not decoded here. Returning an explicit status avoids
        pretending that byte data has been speech-recognized.
        """
        if isinstance(audio_stream, (bytes, bytearray)):
            return {
                "status": "REQUIRES_ASR",
                "text": "",
                "reason": "RAW_AUDIO_MUST_BE_PROCESSED_BY_AN_ASR_ADAPTER",
            }
        text = re.sub(r"\s+", " ", (audio_stream or "").strip())
        return {
            "status": "SUCCESS",
            "text": text,
            "method": "PHONETIC_TEXT_NORMALIZATION",
        }

    def process_smart_transcript(self, raw_text: str) -> Dict[str, Any]:
        """Run the safe text-processing pipeline and return an auditable result."""
        sanitized = self.sanitize_phonetic_speech(raw_text)
        if sanitized["status"] != "SUCCESS":
            return sanitized
        grammar = self.correct_contextual_grammar(sanitized["text"])
        punctuated = self.apply_smart_punctuation(grammar["corrected"])
        result = {
            "status": "SUCCESS",
            "original": raw_text,
            "corrected": grammar["corrected"],
            "text": punctuated,
            "correction": grammar,
            "punctuation": "SMART_CONSERVATIVE",
        }
        self.ledger.record_event("SMART_VOICE_PROCESSED", result)
        return result

    def identify_and_process_transcript(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        processed = self.process_smart_transcript(transcript)
        if processed["status"] != "SUCCESS":
            return processed
        speaker_info = self.identify_speaker(speaker_signature)
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

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        return self.identify_and_process_transcript(speaker_signature, transcript)
