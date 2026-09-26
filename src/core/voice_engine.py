"""Mosharrof context-aware voice journal engine.

The engine keeps recording authorization explicit and provides a model-agnostic
text normalization boundary for smart punctuation, contextual correction and
phonetic sanitization. Actual audio-to-text transcription is delegated to an
attached provider; this module never pretends to decode raw audio by itself.
"""

from typing import Any, Callable, Dict, Optional
import re

from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    def __init__(
        self,
        memory_ledger: Optional[MemoryLedger] = None,
        transcription_provider: Optional[Callable[[Any], str]] = None,
        contextual_corrector: Optional[Callable[[str, str], str]] = None,
    ):
        self.ledger = memory_ledger or MemoryLedger()
        self.is_listening = False
        self.recording_authorized = False
        self.known_voices: Dict[str, str] = {}
        self.transcription_provider = transcription_provider
        self.contextual_corrector = contextual_corrector

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
        """Add conservative punctuation without inventing words.

        This text-only layer cannot infer acoustic pause/intonation until an STT
        provider exposes those signals, so it uses reliable linguistic cues.
        """
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        text = re.sub(r"\s+([,।!?])", r"\1", text)
        text = re.sub(r",{2,}", ",", text)
        text = re.sub(r"!{2,}", "!", text)
        text = re.sub(r"\?{2,}", "?", text)
        text = re.sub(r"।{2,}", "।", text)

        question_cues = (
            "কি ", "কেন ", "কীভাবে ", "কিভাবে ", "কোথায় ", "কোথায় ",
            "কখন ", "কে ", "কোন ", "কোনটা ", "কত ", "হবে কি"
        )
        if not text.endswith((".", "!", "?", "।")):
            if text.startswith(question_cues) or text.endswith((" কি", " কেন", " কীভাবে", " কিভাবে")):
                text += "?"
            else:
                text += "।"
        return text

    @staticmethod
    def correct_contextual_grammar(raw_text: str, context: str = "") -> str:
        """Apply high-confidence Bengali normalization only."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        replacements = {
            "কি করতেছেন": "কি করছেন",
            "কি করতেছ": "কি করছ",
            "করতেছেন": "করছেন",
            "করতেছ": "করছ",
            "যাইতেছি": "যাচ্ছি",
            "আসতেছি": "আসছি",
            "করবেনা": "করবে না",
        }
        for source, target in replacements.items():
            text = text.replace(source, target)
        return text

    def _correct_with_context(self, raw_text: str, context: str) -> str:
        corrected = self.correct_contextual_grammar(raw_text, context)
        if self.contextual_corrector is None:
            return corrected
        candidate = self.contextual_corrector(corrected, context)
        return candidate.strip() if isinstance(candidate, str) and candidate.strip() else corrected

    def sanitize_phonetic_speech(self, audio_stream: Any, context: str = "") -> Dict[str, Any]:
        """Transcribe authorized audio and normalize the resulting transcript."""
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if self.transcription_provider is None:
            return {"status": "UNAVAILABLE", "reason": "NO_TRANSCRIPTION_PROVIDER_ATTACHED"}
        transcript = self.transcription_provider(audio_stream)
        if not isinstance(transcript, str):
            return {"status": "INVALID_TRANSCRIPT", "reason": "TRANSCRIPT_MUST_BE_TEXT"}
        normalized = self.apply_smart_punctuation(
            self._correct_with_context(transcript, context)
        )
        return {"status": "SUCCESS", "raw_transcript": transcript,
                "sanitized_text": normalized}

    def process_voice_text(self, raw_text: str, context: str = "") -> Dict[str, Any]:
        corrected = self._correct_with_context(raw_text, context)
        punctuated = self.apply_smart_punctuation(corrected)
        return {"status": "SUCCESS" if punctuated else "EMPTY", "raw_text": raw_text,
                "corrected_text": corrected, "final_text": punctuated}

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        speaker_info = self.identify_speaker(speaker_signature)
        normalized = self.process_voice_text(transcript)["final_text"]
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", {
            "speaker": speaker_info["speaker"], "transcript": normalized,
            "is_known_person": speaker_info["is_known"], "privacy_status": "LOCAL_ONLY",
        })
        return {"status": "SUCCESS", "detected_speaker": speaker_info["speaker"],
                "is_known": speaker_info["is_known"], "normalized_transcript": normalized}
