"""Context-aware voice journal processing for Mosharrof.

This module intentionally separates transcript cleanup from speech recognition.
A browser/device speech recognizer can supply text; the engine then performs
punctuation, conservative contextual correction, and phonetic normalization.
It never silently invents audio content.
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
            return {"listening_state": "BLOCKED", "recording_authorized": False, "reason": "EXPLICIT_AUTHORIZATION_REQUIRED"}
        self.is_listening = state
        self.recording_authorized = state and authorized
        return {"listening_state": "ACTIVE" if self.is_listening else "INACTIVE", "recording_authorized": self.recording_authorized}

    def identify_speaker(self, voice_signature: str) -> Dict[str, Any]:
        if voice_signature in self.known_voices:
            return {"is_known": True, "speaker": self.known_voices[voice_signature]}
        return {"is_known": False, "speaker": "UNKNOWN_VOICE"}

    @staticmethod
    def apply_smart_punctuation(raw_text: str) -> str:
        """Add conservative punctuation without rewriting the user's words."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        text = re.sub(r"\s+([,।?!])", r"\1", text)
        text = re.sub(r"([,।?!])(?=\S)", r"\1 ", text)
        # Speech recognizers often omit the final mark. Keep explicit marks intact.
        if text.endswith(("?", "!", "।", ".")):
            return text
        question_markers = (
            "কি ", "কী ", "কেন ", "কিভাবে ", "কীভাবে ", "কখন ", "কোথায় ",
            "কোথায় ", "who ", "what ", "why ", "how ", "when ", "where ",
            "is ", "are ", "do ", "does ", "did "
        )
        lowered = text.lower()
        if lowered.startswith(question_markers) or any(
            lowered.startswith(marker.strip()) for marker in question_markers
        ):
            return text + "?"
        return text + "।" if re.search(r"[\u0980-\u09ff]", text) else text + "."

    @staticmethod
    def correct_contextual_grammar(raw_text: str) -> str:
        """Apply only high-confidence, context-safe transcript corrections."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        replacements = {
            "মোশারফ প্রজেক্ট": "মোশাররফ প্রজেক্ট",
            "মোশারফ প্রজেক্টের": "মোশাররফ প্রজেক্টের",
            "মোশারফ এআই": "মোশাররফ AI",
            "মোশারফ ai": "মোশাররফ AI",
        }
        for source, target in replacements.items():
            text = text.replace(source, target)
        return text

    @classmethod
    def sanitize_phonetic_speech(cls, audio_stream: Union[str, bytes, bytearray]) -> Dict[str, Any]:
        """Normalize recognizer output; actual ASR remains the device/provider layer."""
        if isinstance(audio_stream, (bytes, bytearray)):
            try:
                raw_text = bytes(audio_stream).decode("utf-8")
            except UnicodeDecodeError:
                return {"status": "UNSUPPORTED_AUDIO", "reason": "ASR_PROVIDER_REQUIRED"}
        elif isinstance(audio_stream, str):
            raw_text = audio_stream
        else:
            return {"status": "UNSUPPORTED_AUDIO", "reason": "ASR_PROVIDER_REQUIRED"}

        corrected = cls.correct_contextual_grammar(raw_text)
        punctuated = cls.apply_smart_punctuation(corrected)
        return {
            "status": "SUCCESS",
            "raw_text": raw_text.strip(),
            "text": punctuated,
            "processing": ["contextual_correction", "smart_punctuation"],
        }

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        smart = self.sanitize_phonetic_speech(transcript)
        speaker_info = self.identify_speaker(speaker_signature)
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", {
            "speaker": speaker_info["speaker"],
            "transcript": smart.get("text", transcript),
            "is_known_person": speaker_info["is_known"],
            "privacy_status": "LOCAL_ONLY",
        })
        return {
            "status": "SUCCESS",
            "detected_speaker": speaker_info["speaker"],
            "is_known": speaker_info["is_known"],
            "transcript": smart.get("text", transcript),
        }
