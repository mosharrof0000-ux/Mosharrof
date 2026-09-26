"""Context-aware Mosharrof voice journal engine.

The engine keeps audio authorization explicit and provides a conservative text
normalization layer for transcripts. It never invents facts and keeps the
original transcript available to callers.
"""

import re
from typing import Any, Dict, Optional
from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    def __init__(self, memory_ledger: Optional[MemoryLedger] = None):
        self.ledger = memory_ledger or MemoryLedger()
        self.is_listening = False
        self.recording_authorized = False
        self.known_voices: Dict[str, str] = {}
        self.context_terms: Dict[str, str] = {}

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

    def apply_smart_punctuation(self, raw_text: str) -> str:
        """Conservatively punctuate a transcript without changing its words."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        text = re.sub(r"\s+([,।?!])", r"\1", text)
        text = re.sub(r"([,।?!])(?=\S)", r"\1 ", text)
        if text.endswith(("?", "!", "।", ".")):
            return text
        question_markers = ("কি", "কেন", "কীভাবে", "কোথায়", "কোথায়",
                            "কখন", "where", "why", "how", "what")
        if text.lower().startswith(question_markers):
            return text + "?"
        return text + "।"

    def correct_contextual_grammar(self, raw_text: str, context: Optional[str] = None) -> str:
        """Apply only explicitly registered, context-approved substitutions."""
        text = (raw_text or "").strip()
        if not text:
            return ""
        terms = dict(self.context_terms)
        if context:
            for item in context.split(","):
                if "=" in item:
                    source, target = (part.strip() for part in item.split("=", 1))
                    if source and target:
                        terms[source] = target
        for source, target in sorted(terms.items(), key=lambda pair: len(pair[0]), reverse=True):
            text = re.sub(r"(?<!\S)" + re.escape(source) + r"(?!\S)", target, text)
        return text

    def sanitize_phonetic_speech(
        self, audio_stream: Any, *, transcript: str = "", context: Optional[str] = None
    ) -> Dict[str, Any]:
        """Normalize a supplied transcript; audio decoding remains provider-specific."""
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        original = (transcript or "").strip()
        corrected = self.correct_contextual_grammar(original, context)
        punctuated = self.apply_smart_punctuation(corrected)
        return {"status": "SUCCESS", "audio_received": audio_stream is not None,
                "original_transcript": original, "text": punctuated,
                "corrections_applied": original != corrected}

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        speaker_info = self.identify_speaker(speaker_signature)
        normalized = self.apply_smart_punctuation(transcript)
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", {
            "speaker": speaker_info["speaker"], "transcript": normalized,
            "original_transcript": transcript, "is_known_person": speaker_info["is_known"],
            "privacy_status": "LOCAL_ONLY",
        })
        return {"status": "SUCCESS", "detected_speaker": speaker_info["speaker"],
                "is_known": speaker_info["is_known"], "transcript": normalized}
