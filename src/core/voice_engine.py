"""Mosharrof context-aware voice journal engine.

Recording authorization stays explicit. Text normalization is model-agnostic:
smart punctuation, conservative contextual correction, and provider-backed
speech-to-text sanitization are kept behind the voice entity boundary.
"""

from typing import Any, Callable, Dict, Optional
import re

from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    def __init__(
        self,
        memory_ledger: Optional[MemoryLedger] = None,
        transcription_provider: Optional[Callable[[Any], str]] = None,
    ):
        self.ledger = memory_ledger or MemoryLedger()
        self.is_listening = False
        self.recording_authorized = False
        self.known_voices: Dict[str, str] = {}
        self.transcription_provider = transcription_provider

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

    @staticmethod
    def apply_smart_punctuation(raw_text: str) -> str:
        """Infer a conservative terminal mark without inventing lexical content."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""

        text = re.sub(r"\s+([,।!?])", r"\1", text)
        text = re.sub(r",+", ",", text)
        text = re.sub(r"!+", "!", text)
        text = re.sub(r"\?+", "?", text)
        text = re.sub(r"।+", "।", text)

        if text[-1] in ".!?।":
            return text

        # These are high-signal Bengali interrogative forms. Ambiguous text
        # remains a statement rather than being silently converted to a question.
        question_patterns = (
            r"(^|\s)কি($|\s)",
            r"(^|\s)কী($|\s)",
            r"(^|\s)কেন($|\s)",
            r"(^|\s)কোথায়($|\s)",
            r"(^|\s)কোথায়($|\s)",
            r"(^|\s)কখন($|\s)",
            r"(^|\s)কিভাবে($|\s)",
            r"(^|\s)কীভাবে($|\s)",
            r"(^|\s)কত($|\s)",
            r"(^|\s)কে($|\s)",
            r"\?$",
        )
        if any(re.search(pattern, text) for pattern in question_patterns):
            return text + "?"
        return text + "।"

    @staticmethod
    def correct_contextual_grammar(raw_text: str, context: str = "") -> str:
        """Perform only high-confidence, context-safe normalization."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""

        replacements = {
            "কি করতেছ": "কি করছ",
            "করতেছেন": "করছেন",
            "যাইতেছি": "যাচ্ছি",
            "আসতেছি": "আসছি",
            "করবেনা": "করবে না",
        }
        for source, target in replacements.items():
            text = text.replace(source, target)
        return text

    def sanitize_phonetic_speech(self, audio_stream: Any) -> Dict[str, Any]:
        """Transcribe authorized audio through the configured provider."""
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if self.transcription_provider is None:
            return {
                "status": "UNAVAILABLE",
                "reason": "NO_TRANSCRIPTION_PROVIDER_ATTACHED",
            }
        try:
            transcript = self.transcription_provider(audio_stream)
            normalized = self.process_voice_text(transcript)
        except Exception as exc:
            return {
                "status": "ERROR",
                "reason": "TRANSCRIPTION_PROVIDER_FAILED",
                "detail": str(exc),
            }
        return {
            "status": normalized["status"],
            "raw_transcript": transcript,
            "sanitized_text": normalized["final_text"],
            "corrections_applied": normalized["corrected_text"] != transcript.strip(),
        }

    def process_voice_text(self, raw_text: str, context: str = "") -> Dict[str, Any]:
        """Normalize a transcript through the context-aware text pipeline."""
        corrected = self.correct_contextual_grammar(raw_text, context)
        punctuated = self.apply_smart_punctuation(corrected)
        return {
            "status": "SUCCESS" if punctuated else "EMPTY",
            "raw_text": raw_text,
            "corrected_text": corrected,
            "final_text": punctuated,
        }

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        speaker_info = self.identify_speaker(speaker_signature)
        normalized = self.process_voice_text(transcript)["final_text"]
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", {
            "speaker": speaker_info["speaker"],
            "transcript": normalized,
            "is_known_person": speaker_info["is_known"],
            "privacy_status": "LOCAL_ONLY",
        })
        return {
            "status": "SUCCESS",
            "detected_speaker": speaker_info["speaker"],
            "is_known": speaker_info["is_known"],
            "normalized_transcript": normalized,
        }
