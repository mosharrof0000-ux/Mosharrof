"""Context-aware voice journal boundary for Mosharrof.

The engine deliberately separates audio capture from transcript processing.
An external speech-to-text provider may supply text; this module then performs
safe, deterministic punctuation and conservative context normalization.
"""

import re
from typing import Any, Dict, Optional
from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    """Voice input boundary with authorization and context-aware text cleanup."""

    SAFE_CORRECTIONS = {
        "মশাররফ এআই": "মোশাররফ AI",
        "মোশারফ এআই": "মোশাররফ AI",
        "মোশাররফ প্রজেক্ট": "মোশাররফ প্রজেক্ট",
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
            return {"listening_state": "BLOCKED", "recording_authorized": False,
                    "reason": "EXPLICIT_AUTHORIZATION_REQUIRED"}
        self.is_listening = state
        self.recording_authorized = state and authorized
        return {"listening_state": "ACTIVE" if self.is_listening else "INACTIVE",
                "recording_authorized": self.recording_authorized}

    def identify_speaker(self, voice_signature: str) -> Dict[str, Any]:
        if voice_signature in self.known_voices:
            return {"is_known": True, "speaker": self.known_voices[voice_signature]}
        return {"is_known": False, "speaker": "UNKNOWN_VOICE"}

    @classmethod
    def apply_smart_punctuation(cls, raw_text: str) -> str:
        """Add conservative Bengali punctuation without rewriting the meaning."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        text = re.sub(r"\s+([,।?!])", r"\1", text)
        text = re.sub(r"([,।?!])(?=\S)", r"\1 ", text)
        if text[-1] not in "।?!":
            lowered = text.lower()
            question_markers = ("কি ", "কেন ", "কীভাবে ", "কখন ", "কোথায় ",
                                "কোথায় ", "কোথায়", "কোথায়", "কী ", "will ",
                                "what ", "why ", "how ", "when ", "where ",
                                "can ", "is ", "are ")
            if any(marker in lowered for marker in question_markers):
                text += "?"
            else:
                text += "।"
        return text

    @classmethod
    def correct_contextual_grammar(cls, raw_text: str) -> str:
        """Apply only conservative, explicit lexical normalizations."""
        text = (raw_text or "").strip()
        for source, target in cls.SAFE_CORRECTIONS.items():
            text = re.sub(re.escape(source), target, text, flags=re.IGNORECASE)
        text = re.sub(r"\b(হ্যাঁ|না)(?:\s+\1)+\b", r"\1", text, flags=re.IGNORECASE)
        return text

    @classmethod
    def sanitize_phonetic_speech(cls, audio_stream: Any) -> str:
        """Normalize an already-transcribed speech stream.

        Actual speech-to-text is provider-specific and intentionally stays behind
        the BrainAdapter/provider boundary. This method accepts transcript text
        or an object exposing a transcript attribute and returns safe text.
        """
        transcript = audio_stream if isinstance(audio_stream, str) else getattr(audio_stream, "transcript", "")
        return cls.apply_smart_punctuation(cls.correct_contextual_grammar(transcript))

    def process_transcript(self, raw_text: str) -> Dict[str, Any]:
        corrected = self.correct_contextual_grammar(raw_text)
        punctuated = self.apply_smart_punctuation(corrected)
        result = {"status": "SUCCESS" if punctuated else "EMPTY",
                  "raw_text": raw_text or "", "processed_text": punctuated,
                  "correction_applied": corrected != (raw_text or "").strip()}
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
            "transcript": processed["processed_text"],
            "is_known_person": speaker_info["is_known"],
            "privacy_status": "LOCAL_ONLY",
        })
        return {"status": "SUCCESS", "detected_speaker": speaker_info["speaker"],
                "is_known": speaker_info["is_known"],
                "processed_text": processed["processed_text"]}