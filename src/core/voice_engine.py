"""Context-aware voice processing boundary for the Mosharrof voice entity."""

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

    @staticmethod
    def apply_smart_punctuation(raw_text: str) -> str:
        """Conservatively normalize spacing and infer a final Bengali/English mark."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        text = re.sub(r"\s+([,।?!])", r"\1", text)
        text = re.sub(r"([,।?!])(?=\S)", r"\1 ", text)
        question_markers = (
            "কি", "কী", "কেন", "কোথায়", "কোথায়", "কখন",
            "কিভাবে", "কীভাবে", "কত", "কে"
        )
        if not re.search(r"[।?!]$", text):
            text += "?" if any(m in text.lower() for m in question_markers) else "।"
        return re.sub(r"[।?!]{2,}$", lambda m: m.group(0)[0], text)

    @staticmethod
    def correct_contextual_grammar(raw_text: str) -> str:
        """Apply only high-confidence lexical corrections; ambiguous words stay unchanged."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        corrections = {
            "কোরআন": "কুরআন",
            "কোরান": "কুরআন",
            "আল কোরআন": "আল-কুরআন",
            "মোশারফ": "মোশাররফ",
        }
        for source, target in corrections.items():
            text = re.sub(rf"(?<!\S){re.escape(source)}(?!\S)", target, text)
        return text

    @classmethod
    def normalize_transcript(cls, raw_text: str) -> Dict[str, Any]:
        original = re.sub(r"\s+", " ", (raw_text or "").strip())
        corrected = cls.correct_contextual_grammar(original)
        normalized = cls.apply_smart_punctuation(corrected)
        return {
            "status": "SUCCESS" if normalized else "EMPTY",
            "raw_text": raw_text or "",
            "normalized_text": normalized,
            "corrections_applied": corrected != original,
        }

    def sanitize_phonetic_speech(
        self, audio_stream: Any, transcriber: Optional[Callable[[Any], str]] = None
    ) -> Dict[str, Any]:
        """Run authorized audio through an injected ASR adapter, then normalize text."""
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if transcriber is None:
            return {"status": "UNAVAILABLE", "reason": "TRANSCRIBER_ADAPTER_REQUIRED"}
        try:
            transcript = transcriber(audio_stream)
        except Exception as exc:
            return {"status": "ERROR", "reason": "TRANSCRIBER_FAILED", "detail": str(exc)}
        result = self.normalize_transcript(transcript)
        result["input_mode"] = "AUDIO"
        return result

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        normalized = self.normalize_transcript(transcript)
        speaker_info = self.identify_speaker(speaker_signature)
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", {
            "speaker": speaker_info["speaker"],
            "transcript": normalized["normalized_text"],
            "raw_transcript": transcript,
            "is_known_person": speaker_info["is_known"],
            "privacy_status": "LOCAL_ONLY",
        })
        return {
            "status": "SUCCESS",
            "detected_speaker": speaker_info["speaker"],
            "is_known": speaker_info["is_known"],
            "transcript": normalized["normalized_text"],
            "corrections_applied": normalized["corrections_applied"],
        }
