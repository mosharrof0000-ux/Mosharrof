"""Context-aware voice processing with explicit recording authorization.

The engine deliberately keeps speech normalization conservative: it can add
punctuation and correct a small, auditable set of common speech variants, but
it never claims to perform audio-to-text without an attached speech provider.
"""
import re
from typing import Any, Dict, Optional
from src.core.memory_ledger import MemoryLedger

class VoiceJournalEngine:
    DEFAULT_CORRECTIONS = {
        "কোরআন রিসার্চ": "কুরআন রিসার্চ",
        "মোশারফ": "মোশাররফ",
        "মশাররফ": "মোশাররফ",
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

    @staticmethod
    def apply_smart_punctuation(raw_text: str) -> str:
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        text = re.sub(r"\s+([,।!?])", r"\1", text)
        if text.endswith(("?", "!", "।")):
            return text
        question_starters = (
            "কি ", "কী ", "কেন ", "কিভাবে ", "কীভাবে ", "কোথায় ",
            "কোথায় ", "কে ", "কখন ", "হবে কি", "পারবে কি",
        )
        if text.startswith(question_starters) or text.endswith((" কি", " কী")):
            return text + "?"
        return text + "।"

    def correct_contextual_grammar(self, raw_text: str) -> str:
        text = (raw_text or "").strip()
        for source, target in self.DEFAULT_CORRECTIONS.items():
            text = text.replace(source, target)
        return re.sub(r"\s+", " ", text)

    def sanitize_phonetic_speech(self, audio_stream: Any) -> Dict[str, Any]:
        if isinstance(audio_stream, str):
            corrected = self.correct_contextual_grammar(audio_stream)
            return {"status": "SUCCESS", "source": "TRANSCRIPT",
                    "text": self.apply_smart_punctuation(corrected)}
        return {"status": "PROVIDER_REQUIRED", "source": "AUDIO_STREAM",
                "reason": "SPEECH_TO_TEXT_PROVIDER_NOT_ATTACHED"}

    def process_voice_text(self, raw_text: str) -> Dict[str, Any]:
        corrected = self.correct_contextual_grammar(raw_text)
        punctuated = self.apply_smart_punctuation(corrected)
        return {"status": "SUCCESS" if punctuated else "EMPTY",
                "raw_text": raw_text, "corrected_text": corrected, "text": punctuated}

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        processed = self.process_voice_text(transcript)
        speaker_info = self.identify_speaker(speaker_signature)
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", {
            "speaker": speaker_info["speaker"], "transcript": processed["text"],
            "raw_transcript": transcript, "is_known_person": speaker_info["is_known"],
            "privacy_status": "LOCAL_ONLY",
        })
        return {"status": "SUCCESS", "detected_speaker": speaker_info["speaker"],
                "is_known": speaker_info["is_known"], "transcript": processed["text"]}
