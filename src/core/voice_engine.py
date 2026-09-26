"""Context-aware voice journal boundary with explicit recording authorization.

The engine intentionally separates deterministic text cleanup from audio/ASR.
Actual speech recognition remains a provider concern; this layer can normalize
the transcript after an ASR provider returns text.
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

    def toggle_listening(self, state: bool, authorized: bool = False) -> Dict[str, Any]:
        if state and not authorized:
            self.is_listening = False
            self.recording_authorized = False
            return {"listening_state": "BLOCKED", "recording_authorized": False,
                    "reason": "EXPLICIT_AUTHORIZATION_REQUIRED"}
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
        """Add conservative punctuation without inventing missing words."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        if text[-1] in ".!?।?":
            return text
        # A question is recognized only from explicit interrogative wording.
        question_markers = (
            "কি ", "কেন ", "কীভাবে ", "কখন ", "কোথায় ", "কোথায় ",
            "কোথায়?", "কোথায়?", "হয় কি", "হয় কি", "is ", "are ",
            "do ", "does ", "did ", "why ", "how ", "what ", "where ",
            "when ", "can ", "could ", "will ",
        )
        if text.lower().startswith(question_markers):
            return text + "?"
        return text + ("।" if re.search(r"[\u0980-\u09ff]", text) else ".")

    @staticmethod
    def correct_contextual_grammar(raw_text: str) -> str:
        """Apply only high-confidence, non-semantic transcript normalizations."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        replacements = {
            "কুরান": "কুরআন",
            "কোরান": "কুরআন",
            "আল কোরআন": "আল-কুরআন",
            "আল কুরআন": "আল-কুরআন",
            "মোশারফ": "মোশাররফ",
        }
        for source, target in replacements.items():
            text = re.sub(re.escape(source), target, text, flags=re.IGNORECASE)
        return text

    @staticmethod
    def sanitize_phonetic_speech(audio_stream: Any) -> Dict[str, Any]:
        """Normalize an ASR transcript; raw audio requires an external ASR provider."""
        if isinstance(audio_stream, str):
            corrected = VoiceJournalEngine.correct_contextual_grammar(audio_stream)
            return {
                "status": "SUCCESS",
                "input_type": "TRANSCRIPT",
                "text": VoiceJournalEngine.apply_smart_punctuation(corrected),
                "provider_required": False,
            }
        return {
            "status": "PROVIDER_REQUIRED",
            "input_type": type(audio_stream).__name__,
            "provider_required": True,
            "reason": "RAW_AUDIO_REQUIRES_SPEECH_TO_TEXT_PROVIDER",
        }

    def process_transcript(self, transcript: str) -> Dict[str, Any]:
        """Run the deterministic post-ASR voice pipeline."""
        corrected = self.correct_contextual_grammar(transcript)
        punctuated = self.apply_smart_punctuation(corrected)
        result = {
            "status": "SUCCESS" if punctuated else "EMPTY",
            "text": punctuated,
            "correction_applied": corrected != (transcript or "").strip(),
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
        return {
            "status": "SUCCESS",
            "detected_speaker": speaker_info["speaker"],
            "is_known": speaker_info["is_known"],
            "transcript": processed["text"],
        }
