"""Context-aware, provider-neutral voice processing boundary."""

from typing import Any, Dict, Optional
from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    def __init__(self, memory_ledger: Optional[MemoryLedger] = None, correction_provider=None):
        self.ledger = memory_ledger or MemoryLedger()
        self.correction_provider = correction_provider
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
        import re
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        text = re.sub(r"\s+([,!?।])", r"\1", text)
        text = re.sub(r"([,!?।]){2,}", r"\1", text)
        if text.endswith(("?", "!", "।", ".")):
            return text
        if re.match(r"^(কি|কী|কেন|কখন|কোথায়|কোথায়|কিভাবে|কীভাবে|is |are |am |do |does |did |why |when |where |how )", text, re.I):
            return text + "?"
        return text + "।"

    @staticmethod
    def _basic_context_corrections(text: str) -> str:
        replacements = {"মশারফ":"মোশাররফ","মোশারফ":"মোশাররফ","মোসাররফ":"মোশাররফ","কোরান":"কুরআন","কোরআন":"কুরআন"}
        for source, target in replacements.items():
            text = re.sub(rf"(?<!\S){re.escape(source)}(?!\S)", target, text, flags=re.IGNORECASE)
        return text

    def correct_contextual_grammar(self, raw_text: str, context: str = "") -> str:
        import re
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        if self.correction_provider is not None:
            corrected = self.correction_provider(text, context or "")
            if isinstance(corrected, str) and corrected.strip():
                text = corrected.strip()
        else:
            text = self._basic_context_corrections(text)
        return self.apply_smart_punctuation(text)

    def sanitize_phonetic_speech(self, audio_stream: Any = None, *, transcript: str = "", context: str = "", transcriber=None) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status":"BLOCKED","reason":"RECORDING_NOT_AUTHORIZED"}
        if not transcript and transcriber is not None:
            transcript = transcriber(audio_stream)
        if not isinstance(transcript, str) or not transcript.strip():
            return {"status":"EMPTY","message":"No speech transcript supplied."}
        normalized = self.correct_contextual_grammar(transcript, context)
        result = {"status":"SUCCESS","raw_transcript":transcript,"normalized_text":normalized,"punctuation_applied":normalized != transcript.strip(),"context_used":bool(context.strip()),"provider_attached":self.correction_provider is not None}
        self.ledger.record_event("VOICE_TEXT_NORMALIZED", result)
        return result

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        speaker_info = self.identify_speaker(speaker_signature)
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", {
            "speaker": speaker_info["speaker"],
            "transcript": transcript,
            "is_known_person": speaker_info["is_known"],
            "privacy_status": "LOCAL_ONLY",
        })
        return {"status": "SUCCESS", "detected_speaker": speaker_info["speaker"], "is_known": speaker_info["is_known"]}
