"""Context-aware voice journal processing with explicit recording authorization.

This layer processes transcript text. Raw audio decoding remains the responsibility
of a dedicated speech-recognition provider.
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
        """Conservatively normalize whitespace and close an unpunctuated sentence."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        text = re.sub(r"\s+([,।?!])", r"\1", text)
        if text[-1] not in "।?!,":
            text += "।"
        return text

    @staticmethod
    def correct_contextual_grammar(raw_text: str) -> str:
        """Apply only high-confidence Bengali transcript normalizations."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        replacements = {
            "কোরআন": "কুরআন",
            "কুরান": "কুরআন",
            "মোশারফ": "মোশাররফ",
        }
        for source, target in replacements.items():
            text = re.sub(rf"(?<!\S){re.escape(source)}(?!\S)", target, text)
        return text

    @classmethod
    def sanitize_phonetic_speech(cls, audio_stream: Any) -> str:
        """Normalize text produced by an ASR provider before it reaches the Core."""
        if audio_stream is None:
            return ""
        raw_text = audio_stream if isinstance(audio_stream, str) else str(audio_stream)
        return cls.apply_smart_punctuation(cls.correct_contextual_grammar(raw_text))

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        normalized = self.sanitize_phonetic_speech(transcript)
        speaker_info = self.identify_speaker(speaker_signature)
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", {
            "speaker": speaker_info["speaker"],
            "transcript": normalized,
            "original_transcript": transcript,
            "is_known_person": speaker_info["is_known"],
            "privacy_status": "LOCAL_ONLY",
        })
        return {"status": "SUCCESS", "detected_speaker": speaker_info["speaker"],
                "is_known": speaker_info["is_known"], "transcript": normalized}
