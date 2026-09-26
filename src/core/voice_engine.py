"""Context-aware voice processing boundary for Mosharrof."""
import re
from typing import Any, Dict, Optional
from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    COMMON_CONTEXT_CORRECTIONS = {
        "মোশারফ প্রজেক্ট": "মোশাররফ প্রজেক্ট",
        "মশাররফ": "মোশাররফ",
        "মোশারফ": "মোশাররফ",
        "কোরান": "কুরআন",
    }
    PHONETIC_NORMALIZATION = {
        "করতেছি": "করছি",
        "করতেছেন": "করছেন",
        "দিতেছি": "দিচ্ছি",
        "যাইতেছি": "যাচ্ছি",
        "আসতেছি": "আসছি",
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
    def apply_smart_punctuation(cls, raw_text: str) -> str:
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        text = re.sub(r"\s+([,।?!])", r"\1", text)
        if not text:
            return ""
        if text.endswith((".", "।", "?", "!")):
            return text
        question_markers = (
            "কি ", "কী ", "কেন ", "কখন ", "কোথায় ", "কোথায় ",
            "কীভাবে ", "কিভাবে ", "কে ", "কোন ", "কত ",
        )
        if text.startswith(question_markers):
            return text + "?"
        return text + "।"

    @classmethod
    def correct_contextual_grammar(cls, raw_text: str) -> str:
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        for source, target in cls.COMMON_CONTEXT_CORRECTIONS.items():
            text = text.replace(source, target)
        return text

    @classmethod
    def sanitize_phonetic_speech(cls, audio_stream: Any) -> str:
        text = (
            audio_stream.decode("utf-8", errors="replace")
            if isinstance(audio_stream, bytes)
            else str(audio_stream or "")
        )
        text = re.sub(r"\s+", " ", text).strip()
        text = re.sub(r"([,।?!])\1+", r"\1", text)
        for source, target in cls.PHONETIC_NORMALIZATION.items():
            text = text.replace(source, target)
        return text

    def process_transcript(self, raw_text: str) -> Dict[str, Any]:
        sanitized = self.sanitize_phonetic_speech(raw_text)
        corrected = self.correct_contextual_grammar(sanitized)
        final = self.apply_smart_punctuation(corrected)
        result = {
            "status": "SUCCESS" if final else "EMPTY",
            "raw_text": raw_text or "",
            "sanitized_text": sanitized,
            "corrected_text": corrected,
            "final_text": final,
        }
        if final:
            self.ledger.record_event("VOICE_TRANSCRIPT_PROCESSED", result)
        return result

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        processed = self.process_transcript(transcript)
        speaker = self.identify_speaker(speaker_signature)
        self.ledger.record_event(
            "SOCIAL_INTERACTION_LOGGED",
            {
                "speaker": speaker["speaker"],
                "transcript": processed["final_text"],
                "is_known_person": speaker["is_known"],
                "privacy_status": "LOCAL_ONLY",
            },
        )
        return {
            "status": "SUCCESS",
            "detected_speaker": speaker["speaker"],
            "is_known": speaker["is_known"],
            "transcript": processed["final_text"],
        }
