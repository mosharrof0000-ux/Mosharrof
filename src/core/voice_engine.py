"""Context-aware Mosharrof voice journal boundary.

The engine separates audio transcription from text cleanup: an ASR/transcriber
adapter supplies text, then this entity performs conservative punctuation and
normalization. It never invents a semantic correction without an explicit map.
"""
import re
from typing import Any, Callable, Dict, Optional
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
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        text = re.sub(r"\s+([।?!,])", r"\1", text)
        text = re.sub(r",\s*,+", ",", text)
        parts = re.split(r"(?<=[।!?])\s+", text)
        fixed = []
        for part in parts:
            part = part.strip()
            if not part:
                continue
            if part[-1] not in "।!?":
                if re.search(r"(কি|কেন|কীভাবে|কী|কোথায়|কোথায়|কখন|কে|কাকে|হবে কি|হবে?)$", part, re.I):
                    part += "?"
                else:
                    part += "।"
            fixed.append(part)
        return " ".join(fixed)

    @staticmethod
    def correct_contextual_grammar(raw_text: str, context: str = "",
                                    correction_map: Optional[Dict[str, str]] = None) -> str:
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        for source, target in sorted((correction_map or {}).items(), key=lambda item: len(item[0]), reverse=True):
            if source:
                text = text.replace(source, target)
        return text

    def sanitize_phonetic_speech(
        self,
        audio_stream: Any,
        transcriber: Optional[Callable[[Any], str]] = None,
        context: str = "",
        correction_map: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if transcriber is None:
            return {"status": "REQUIRES_TRANSCRIBER", "reason": "AUDIO_TO_TEXT_ADAPTER_REQUIRED"}
        raw_text = transcriber(audio_stream)
        corrected = self.correct_contextual_grammar(raw_text, context, correction_map)
        punctuated = self.apply_smart_punctuation(corrected)
        self.ledger.record_event("VOICE_TEXT_SANITIZED", {
            "context_used": bool(context),
            "correction_count": sum(1 for key in (correction_map or {}) if key in raw_text),
        })
        return {"status": "SUCCESS", "raw_text": raw_text, "text": punctuated}

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        normalized = self.apply_smart_punctuation(transcript)
        speaker_info = self.identify_speaker(speaker_signature)
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", {
            "speaker": speaker_info["speaker"],
            "transcript": normalized,
            "is_known_person": speaker_info["is_known"],
            "privacy_status": "LOCAL_ONLY",
        })
        return {"status": "SUCCESS", "detected_speaker": speaker_info["speaker"], "is_known": speaker_info["is_known"], "transcript": normalized}
