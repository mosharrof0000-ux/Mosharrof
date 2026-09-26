"""Context-aware voice processing boundary for Mosharrof.

Recording authorization is separate from transcript normalization. Real audio
transcription requires an attached ASR provider; this module never guesses audio.
"""

import re
from typing import Any, Dict, Optional, Mapping
from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    QUESTION_STARTERS = (
        "কি ", "কী ", "কেন ", "কখন ", "কোথায় ", "কোথায় ", "কিভাবে ",
        "কীভাবে ", "কত ", "কে ", "কার ", "কোন ", "কোনটি ", "কতটা "
    )

    def __init__(
        self,
        memory_ledger: Optional[MemoryLedger] = None,
        corrections: Optional[Mapping[str, str]] = None,
        asr_provider: Any = None,
        transcription_provider: Any = None,
    ):
        self.ledger = memory_ledger or MemoryLedger()
        self.is_listening = False
        self.recording_authorized = False
        self.known_voices: Dict[str, str] = {}
        self.corrections = dict(corrections or {})
        self.asr_provider = asr_provider or transcription_provider
        self.default_corrections = {
            "করতেছ": "করছ",
            "করতেছে": "করছে",
            "করতেছেন": "করছেন",
            "যাইতেছি": "যাচ্ছি",
            "আসতেছি": "আসছি",
            "হইতেছে": "হচ্ছে",
            "হইছে": "হয়েছে",
        }

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
    def _normalize_spacing(text: str) -> str:
        text = re.sub(r"\s+", " ", (text or "").strip())
        text = re.sub(r"\s+([,!?।])", r"\1", text)
        text = re.sub(r"([,!?।])(?=\S)", r"\1 ", text)
        return text.strip()

    def apply_smart_punctuation(self, raw_text: str) -> str:
        text = self._normalize_spacing(raw_text)
        if not text:
            return ""
        if text[-1] in ".!?।":
            return text
        if text.startswith(self.QUESTION_STARTERS):
            return text + "?"
        return text + "।"

    def correct_contextual_grammar(self, raw_text: str) -> str:
        text = self._normalize_spacing(raw_text)
        if not text:
            return ""
        corrections = {**self.default_corrections, **self.corrections}
        for wrong, right in sorted(corrections.items(), key=lambda item: len(item[0]), reverse=True):
            if wrong:
                text = text.replace(wrong, right)
        text = re.sub(r"\b(\w+)(\s+\1\b)+", r"\1", text, flags=re.IGNORECASE)
        return self._normalize_spacing(text)

    def sanitize_phonetic_speech(self, audio_stream: Any) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if isinstance(audio_stream, str):
            normalized = self.correct_contextual_grammar(audio_stream)
            return {
                "status": "SUCCESS",
                "source": "TEXT_TRANSCRIPT",
                "sanitized_text": self.apply_smart_punctuation(normalized),
            }
        if self.asr_provider is None:
            return {
                "status": "UNAVAILABLE",
                "reason": "ASR_PROVIDER_NOT_ATTACHED",
            }
        if hasattr(self.asr_provider, "transcribe"):
            transcript = self.asr_provider.transcribe(audio_stream)
        else:
            transcript = self.asr_provider(audio_stream)
        return {
            "status": "SUCCESS",
            "source": "ASR_PROVIDER",
            "sanitized_text": self.apply_smart_punctuation(
                self.correct_contextual_grammar(transcript)
            ),
        }

    def process_transcript(self, raw_text: str) -> Dict[str, Any]:
        normalized = self._normalize_spacing(raw_text)
        corrected = self.correct_contextual_grammar(normalized)
        punctuated = self.apply_smart_punctuation(corrected)
        result = {
            "status": "SUCCESS" if punctuated else "EMPTY",
            "raw_text": raw_text,
            "text": punctuated,
            "smart_punctuation": bool(punctuated),
            "contextual_correction": corrected != normalized,
        }
        self.ledger.record_event("VOICE_TRANSCRIPT_PROCESSED", result)
        return result

    def process_voice_text(self, raw_text: str) -> Dict[str, Any]:
        result = self.process_transcript(raw_text)
        return {
            "status": result["status"],
            "final_text": result["text"],
            "smart_punctuation": result["smart_punctuation"],
            "contextual_correction": result["contextual_correction"],
        }

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        processed = self.process_transcript(transcript)
        speaker_info = self.identify_speaker(speaker_signature)
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
}
