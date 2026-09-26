"""Context-aware Mosharrof voice processing with explicit recording authorization.

Speech-to-text is an explicit provider boundary. The engine only records or
processes audio after authorization and only normalizes provider transcripts
with conservative, auditable corrections.
"""

import re
from typing import Any, Callable, Dict, Iterable, Optional, Sequence

from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    DEFAULT_CORRECTIONS = {
        "গবেষনা": "গবেষণা",
        "প্রজেকট": "প্রজেক্ট",
        "খুজে": "খুঁজে",
        "খুজুন": "খুঁজুন",
        "করতেছ": "করছ",
        "করতেছে": "করছে",
    }

    QUESTION_WORDS = (
        "কি", "কী", "কেন", "কখন", "কোথায়", "কোথায়", "কত",
        "কার", "কাকে", "কীভাবে", "কিভাবে", "কোন", "কোনটি",
    )

    def __init__(
        self,
        memory_ledger: Optional[MemoryLedger] = None,
        correction_map: Optional[Dict[str, str]] = None,
        transcription_provider: Optional[Callable[[Any], str]] = None,
    ):
        self.ledger = memory_ledger or MemoryLedger()
        self.is_listening = False
        self.recording_authorized = False
        self.known_voices: Dict[str, str] = {}
        self.transcription_provider = transcription_provider
        self.correction_map = dict(self.DEFAULT_CORRECTIONS)
        if correction_map:
            self.correction_map.update(correction_map)

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
    def _clean_spacing(text: str) -> str:
        text = re.sub(r"[ \t]+", " ", text.strip())
        text = re.sub(r"\s+([,।?!])", r"\1", text)
        text = re.sub(r"([,]){2,}", ",", text)
        return text

    def apply_smart_punctuation(
        self,
        raw_text: str,
        pause_boundaries: Optional[Sequence[int]] = None,
    ) -> str:
        text = self._clean_spacing(raw_text or "")
        if not text:
            return ""

        text = re.sub(r"\s*\[pause\]\s*", "। ", text, flags=re.IGNORECASE)
        if not re.search(r"[?!।]$", text):
            words = [w.strip(".,!?।") for w in text.split()]
            if words and words[-1] in self.QUESTION_WORDS:
                text += "?"
            elif len(words) >= 2 and any(w in self.QUESTION_WORDS for w in words[-3:]):
                text += "?"
            else:
                text += "।"

        text = re.sub(r"।{2,}", "।", text)
        text = re.sub(r"\?+", "?", text)
        text = re.sub(
            r"^(আচ্ছা|তাহলে|তবে|অর্থাৎ|প্রথমে|এরপর|এখন|কিন্তু)\s+",
            r"\1, ", text,
        )
        return text

    def correct_contextual_grammar(
        self,
        raw_text: str,
        context: Optional[Iterable[str]] = None,
    ) -> str:
        text = self._clean_spacing(raw_text or "")
        if not text:
            return ""

        for source, target in self.correction_map.items():
            pattern = rf"(?<!\S){re.escape(source)}(?!\S)"
            text = re.sub(pattern, target, text)
        return text

    def sanitize_phonetic_speech(
        self,
        audio_stream: Any,
        *,
        transcript: Optional[str] = None,
        context: Optional[Iterable[str]] = None,
    ) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}

        if transcript is None:
            if isinstance(audio_stream, str):
                transcript = audio_stream
            elif self.transcription_provider is not None:
                try:
                    transcript = self.transcription_provider(audio_stream)
                except Exception as exc:
                    return {"status": "ERROR", "reason": "STT_PROVIDER_FAILED",
                            "detail": str(exc)}
            else:
                return {"status": "UNAVAILABLE",
                        "reason": "SPEECH_TO_TEXT_PROVIDER_NOT_ATTACHED"}

        corrected = self.correct_contextual_grammar(transcript, context=context)
        punctuated = self.apply_smart_punctuation(corrected)
        return {
            "status": "SUCCESS" if punctuated else "EMPTY",
            "raw_text": transcript,
            "corrected_text": corrected,
            "text": punctuated,
            "sanitized_text": punctuated,
            "stt_provider": "ATTACHED" if self.transcription_provider else "TRANSCRIPT_INPUT",
        }

    def process_voice_transcript(
        self,
        transcript: str,
        *,
        context: Optional[Iterable[str]] = None,
    ) -> Dict[str, Any]:
        return self.sanitize_phonetic_speech(
            transcript, transcript=transcript, context=context
        )

    def process_voice_text(self, raw_text: str, *, context: Optional[Iterable[str]] = None) -> Dict[str, Any]:
        corrected = self.correct_contextual_grammar(raw_text, context=context)
        final_text = self.apply_smart_punctuation(corrected)
        return {
            "status": "SUCCESS" if final_text else "EMPTY",
            "raw_text": raw_text,
            "corrected_text": corrected,
            "final_text": final_text,
            "text": final_text,
        }

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}

        processed = self.process_voice_transcript(transcript)
        speaker_info = self.identify_speaker(speaker_signature)
        self.ledger.record_event(
            "SOCIAL_INTERACTION_LOGGED",
            {
                "speaker": speaker_info["speaker"],
                "transcript": processed["sanitized_text"],
                "raw_transcript": transcript,
                "is_known_person": speaker_info["is_known"],
                "privacy_status": "LOCAL_ONLY",
                "voice_processing": "CONTEXT_AWARE",
            },
        )
        return {
            "status": "SUCCESS",
            "detected_speaker": speaker_info["speaker"],
            "is_known": speaker_info["is_known"],
            "transcript": processed["sanitized_text"],
        }
