"""Context-aware voice processing boundary for Mosharrof.

This module keeps recording authorization separate from transcript cleanup.
It provides deterministic text normalization hooks that can later be backed
by a model adapter without changing the Voice entity contract.
"""

import re
from typing import Any, Dict, Optional
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
        """Apply conservative punctuation without inventing missing content."""
        text = re.sub(r"\\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        text = re.sub(r"\\s+([,।?!])", r"\\1", text)
        if text.endswith(("?", "!", "।")):
            return text
        # A direct question in Bengali/English gets a question mark.
        question_markers = (
            "কি ", "কী ", "কেন ", "কিভাবে ", "কোথায় ", "কোথায় ",
            "কখন ", "কে ", "what ", "why ", "how ", "where ", "when ", "who "
        )
        if text.lower().startswith(tuple(marker.lower() for marker in question_markers)):
            return text + "?"
        return text + "।"

    @staticmethod
    def correct_contextual_grammar(raw_text: str) -> str:
        """Perform only high-confidence, non-semantic transcript corrections."""
        text = re.sub(r"\\s+", " ", (raw_text or "").strip())
        replacements = {
            "কোরআন রিসার্চ": "আল-কুরআন রিসার্চ",
            "কুরান": "কুরআন",
            "মোশারফ": "মোশাররফ",
        }
        for wrong, right in replacements.items():
            text = text.replace(wrong, right)
        return text

    @staticmethod
    def sanitize_phonetic_speech(raw_text: str) -> str:
        """Normalize common spoken-form spacing while preserving meaning."""
        text = re.sub(r"\\s+", " ", (raw_text or "").strip())
        text = re.sub(r"([,।?!])\\1+", r"\\1", text)
        return text

    def process_transcript(self, raw_text: str) -> Dict[str, Any]:
        """Run the safe transcript pipeline after recording authorization."""
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        sanitized = self.sanitize_phonetic_speech(raw_text)
        corrected = self.correct_contextual_grammar(sanitized)
        punctuated = self.apply_smart_punctuation(corrected)
        result = {
            "status": "SUCCESS",
            "raw_text": raw_text or "",
            "text": punctuated,
            "processing": [
                "phonetic_normalization",
                "contextual_high_confidence_correction",
                "smart_punctuation",
            ],
        }
        self.ledger.record_event("VOICE_TRANSCRIPT_PROCESSED", result)
        return result

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        speaker_info = self.identify_speaker(speaker_signature)
        processed = self.process_transcript(transcript)
        if processed["status"] != "SUCCESS":
            return processed
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
