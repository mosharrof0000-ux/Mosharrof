"""Context-aware voice processing boundary for Mosharrof.

The engine deliberately separates transcript cleanup from audio/STT.  Audio
sanitization is represented as a safe adapter boundary; this repository does
not pretend to perform raw audio ML without an attached speech model.
"""

import re
from typing import Any, Dict, Optional
from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    """Authorization, transcript normalization, and voice-journal processing."""

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
        """Add conservative punctuation without inventing missing content."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        text = re.sub(r"\s+([,।!?])", r"\1", text)
        # Preserve already-punctuated input.
        if text[-1] in "।!?":
            return text
        # Bengali/English question cues are useful only when explicit in text.
        if re.search(r"(^|\s)(কি|কেন|কীভাবে|কোথায়|কোথায়|কখন|who|what|why|how|where|when)(\s|$)", text, re.I):
            return text + "?"
        return text + "।"

    @staticmethod
    def correct_contextual_grammar(raw_text: str) -> str:
        """Apply only high-confidence, non-semantic transcript normalizations."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        replacements = {
            "কোরান": "কুরআন",
            "কোরআন": "কুরআন",
            "আল কোরআন": "আল-কুরআন",
        }
        for source, target in replacements.items():
            text = text.replace(source, target)
        text = re.sub(r"\s+([,।!?])", r"\1", text)
        return text

    def sanitize_phonetic_speech(self, audio_stream: Any) -> Dict[str, Any]:
        """Safe adapter boundary for future/attached speech-to-text engines.

        Raw audio is not guessed or rewritten locally. A speech provider must
        supply a transcript before linguistic normalization is applied.
        """
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if audio_stream is None:
            return {"status": "EMPTY", "reason": "AUDIO_STREAM_REQUIRED"}
        return {
            "status": "TRANSCRIPTION_ADAPTER_REQUIRED",
            "message": "Attach an authorized speech-to-text adapter before processing raw audio.",
        }

    def process_transcript(self, transcript: str) -> Dict[str, Any]:
        if not transcript.strip():
            return {"status": "EMPTY", "text": ""}
        corrected = self.correct_contextual_grammar(transcript)
        punctuated = self.apply_smart_punctuation(corrected)
        result = {
            "status": "SUCCESS",
            "raw_text": transcript,
            "text": punctuated,
            "corrections_applied": corrected != transcript.strip(),
        }
        self.ledger.record_event("VOICE_TRANSCRIPT_PROCESSED", result)
        return result

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        processed = self.process_transcript(transcript)
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
            "text": processed["text"],
        }
