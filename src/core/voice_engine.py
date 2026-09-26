"""Context-aware Mosharrof voice processing boundary.

Recording remains explicitly authorized. Transcript cleanup is deterministic and
model-agnostic so a future speech-to-text provider can be attached without
changing the entity contract.
"""

import re
from typing import Any, Dict, Optional

from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    DEFAULT_CONTEXT_CORRECTIONS = {
        "মশারফ": "মোশাররফ",
        "মোশারফ": "মোশাররফ",
        "মোশাররফ এআই": "মোশাররফ AI",
        "কোরান": "কুরআন",
        "কোরআন": "কুরআন",
    }

    def __init__(
        self,
        memory_ledger: Optional[MemoryLedger] = None,
        context_corrections: Optional[Dict[str, str]] = None,
    ):
        self.ledger = memory_ledger or MemoryLedger()
        self.is_listening = False
        self.recording_authorized = False
        self.known_voices: Dict[str, str] = {}
        self.context_corrections = dict(self.DEFAULT_CONTEXT_CORRECTIONS)
        if context_corrections:
            self.context_corrections.update(context_corrections)

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

    def apply_smart_punctuation(self, raw_text: str) -> str:
        """Add conservative punctuation without inventing sentence content."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        text = re.sub(r"\s+([,।?!])", r"\1", text)
        if text.endswith(("।", "!", "?")):
            return text
        if re.search(r"(কি|কেন|কীভাবে|কোথায়|কোথায়|কখন|কে|কোন|হয়েছে কি|হয়েছে কি)\s*$", text, re.I):
            return text + "?"
        return text + "।"

    def correct_contextual_grammar(
        self, raw_text: str, context: Optional[str] = None
    ) -> str:
        """Apply only configured, high-confidence lexical corrections."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        for source, target in sorted(
            self.context_corrections.items(), key=lambda item: len(item[0]), reverse=True
        ):
            text = re.sub(re.escape(source), target, text, flags=re.IGNORECASE)
        return text

    def sanitize_phonetic_speech(
        self, audio_stream: Any, *, transcript: Optional[str] = None,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """Normalize supplied transcript or expose a future ASR adapter boundary."""
        if transcript is None:
            return {
                "status": "AWAITING_ASR",
                "audio_received": audio_stream is not None,
                "message": "Attach a speech-to-text adapter to decode raw audio.",
            }
        return self.process_transcript(transcript, context=context)

    def process_transcript(
        self, transcript: str, *, context: Optional[str] = None
    ) -> Dict[str, Any]:
        corrected = self.correct_contextual_grammar(transcript, context=context)
        punctuated = self.apply_smart_punctuation(corrected)
        result = {
            "status": "SUCCESS" if punctuated else "EMPTY",
            "text": punctuated,
            "source_text": transcript,
            "context_applied": bool(context),
        }
        if punctuated:
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
        return {
            "status": "SUCCESS",
            "detected_speaker": speaker_info["speaker"],
            "is_known": speaker_info["is_known"],
            "transcript": processed["text"],
        }
