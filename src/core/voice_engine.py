"""Voice journal boundary for explicitly authorized local input."""

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

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}

        speaker_info = self.identify_speaker(speaker_signature)
        interaction_data = {
            "speaker": speaker_info["speaker"],
            "transcript": transcript,
            "is_known_person": speaker_info["is_known"],
            "privacy_status": "LOCAL_ONLY",
        }
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", interaction_data)
        return {
            "status": "SUCCESS",
            "detected_speaker": speaker_info["speaker"],
            "is_known": speaker_info["is_known"],
        }
