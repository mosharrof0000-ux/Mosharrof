"""Context-aware voice journal boundary for Mosharrof.

Audio capture and speech-to-text stay behind the provider/model boundary.
This module safely processes transcripts with conservative punctuation and
explicit lexical normalization; it never claims to perform raw audio STT.
"""

import re
from typing import Any, Dict, Optional
from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    """Authorized voice input boundary with context-aware transcript cleanup."""

    SAFE_CORRECTIONS = {
        "কোরান": "কুরআন",
        "কোরআন": "কুরআন",
        "মোশারফ": "মোশাররফ",
        "মশাররফ": "মোশাররফ",
        "মোশাররফ এআই": "মোশাররফ AI",
        "মোশারফ এআই": "মোশাররফ AI",
    }

    QUESTION_MARKERS = (
        "কি ", "কী ", "কেন ", "কীভাবে ", "কখন ", "কোথায় ", "কোথায় ",
        "will ", "what ", "why ", "how ", "when ", "where ", "can ",
        "is ", "are ", "do ", "does "
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
            return {"listening_state": "BLOCKED", "recording_authorized": False,
                    "reason": "EXPLICIT_AUTHORIZATION_REQUIRED"}
        self.is_listening = state
        self.recording_authorized = state and authorized
        return {"listening_state": "ACTIVE" if state else "INACTIVE",
                "recording_authorized": self.recording_authorized}

    def identify_speaker(self, voice_signature: str) -> Dict[str, Any]:
        if voice_signature in self.known_voices:
            return {"is_known": True, "speaker": self.known_voices[voice_signature]}
        return {"is_known": False, "speaker": "UNKNOWN_VOICE"}

    @classmethod
    def correct_contextual_grammar(cls, raw_text: str) -> str:
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        for source, target in cls.SAFE_CORRECTIONS.items():
            text = text.replace(source, target)
        text = re.sub(r"\b(হ্যাঁ|না)(?:\s+\1)+\b", r"\1", text)
        return text

    @classmethod
    def apply_smart_punctuation(cls, raw_text: str) -> str:
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        text = re.sub(r"\s+([,।?!])", r"\1", text)
        text = re.sub(r"([,।?!])(?=\S)", r"\1 ", text)
        if text[-1] in "।?!":
            return text
        lowered = text.lower()
        if any(marker in lowered for marker in cls.QUESTION_MARKERS):
            return text + "?"
        return text + "।"

    @classmethod
    def sanitize_phonetic_speech(cls, audio_stream: Any) -> Any:
        """Normalize transcript text; raw audio requires an attached STT provider."""
        if isinstance(audio_stream, str):
            return cls.apply_smart_punctuation(cls.correct_contextual_grammar(audio_stream))
        transcript = getattr(audio_stream, "transcript", None)
        if isinstance(transcript, str):
            return cls.apply_smart_punctuation(cls.correct_contextual_grammar(transcript))
        return {"status": "PROVIDER_REQUIRED",
                "reason": "RAW_AUDIO_REQUIRES_SPEECH_TO_TEXT_PROVIDER"}

    def process_transcript(self, raw_text: str) -> Dict[str, Any]:
        raw = (raw_text or "").strip()
        if not raw:
            result = {"status": "EMPTY", "raw_text": "", "text": "",
                      "processed_text": "", "correction_applied": False}
            return result
        corrected = self.correct_contextual_grammar(raw)
        punctuated = self.apply_smart_punctuation(corrected)
        result = {
            "status": "SUCCESS",
            "raw_text": raw,
            "text": punctuated,
            "processed_text": punctuated,
            "correction_applied": corrected != raw,
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
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", {
            "speaker": speaker_info["speaker"],
            "transcript": processed["text"],
            "is_known_person": speaker_info["is_known"],
            "privacy_status": "LOCAL_ONLY",
        })
        return {"status": "SUCCESS", "detected_speaker": speaker_info["speaker"],
                "is_known": speaker_info["is_known"],
                "processed_text": processed["text"]}
