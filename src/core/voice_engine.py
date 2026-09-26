"""Context-aware Mosharrof voice processing with explicit recording authorization.

Speech-to-text remains an external boundary. This module normalizes the resulting
transcript with conservative punctuation and context-aware corrections.
"""

import re
from typing import Any, Dict, Iterable, Optional, Sequence
from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    """Voice journal boundary plus conservative transcript intelligence."""

    DEFAULT_CORRECTIONS = {
        "গবেষনা": "গবেষণা",
        "প্রজেকট": "প্রজেক্ট",
        "খুজে": "খুঁজে",
        "খুজুন": "খুঁজুন",
    }

    QUESTION_WORDS = (
        "কি", "কী", "কেন", "কখন", "কোথায়", "কোথায়", "কত",
        "কার", "কাকে", "কীভাবে", "কিভাবে", "কোন", "কোনটি",
    )

    def __init__(
        self,
        memory_ledger: Optional[MemoryLedger] = None,
        correction_map: Optional[Dict[str, str]] = None,
    ):
        self.ledger = memory_ledger or MemoryLedger()
        self.is_listening = False
        self.recording_authorized = False
        self.known_voices: Dict[str, str] = {}
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
        """Add conservative punctuation to an STT transcript.

        Pause markers can be represented as [pause]. Provider timing offsets
        are accepted for API compatibility; punctuation remains conservative
        when only raw text is available.
        """
        text = self._clean_spacing(raw_text or "")
        if not text:
            return ""

        text = re.sub(r"\s*\[pause\]\s*", "। ", text, flags=re.IGNORECASE)

        if not re.search(r"[?!।]$", text):
            words = text.split()
            if words and any(
                word.strip(".,!?।") in self.QUESTION_WORDS for word in words[-4:]
            ):
                text += "?"
            else:
                text += "।"

        text = re.sub(r"।{2,}", "।", text)
        text = re.sub(r"\?+", "?", text)
        text = re.sub(
            r"^(আচ্ছা|তাহলে|তবে|অর্থাৎ|প্রথমে|এরপর|এখন|কিন্তু)\s+",
            r"\1, ",
            text,
        )
        return text

    def correct_contextual_grammar(
        self,
        raw_text: str,
        context: Optional[Iterable[str]] = None,
    ) -> str:
        """Apply only explicit, conservative transcript corrections.

        Unknown or ambiguous speech is preserved rather than guessed.
        """
        text = self._clean_spacing(raw_text or "")
        if not text:
            return ""

        context_text = " ".join(context or ())
        for source, target in self.correction_map.items():
            pattern = rf"(?<!\S){re.escape(source)}(?!\S)"
            if context_text or source in {"গবেষনা", "প্রজেকট", "খুজে", "খুজুন"}:
                text = re.sub(pattern, target, text)
        return text

    def sanitize_phonetic_speech(
        self,
        audio_stream: Any,
        *,
        transcript: Optional[str] = None,
        context: Optional[Iterable[str]] = None,
    ) -> Dict[str, Any]:
        """Normalize provider transcript without pretending to perform STT."""
        raw_text = transcript if transcript is not None else (
            audio_stream if isinstance(audio_stream, str) else ""
        )
        corrected = self.correct_contextual_grammar(raw_text, context=context)
        punctuated = self.apply_smart_punctuation(corrected)
        return {
            "status": "SUCCESS" if punctuated else "EMPTY",
            "raw_text": raw_text,
            "corrected_text": corrected,
            "text": punctuated,
            "stt_provider": "EXTERNAL_BOUNDARY",
        }

    def process_voice_transcript(
        self,
        transcript: str,
        *,
        context: Optional[Iterable[str]] = None,
    ) -> Dict[str, Any]:
        return self.sanitize_phonetic_speech(
            transcript,
            transcript=transcript,
            context=context,
        )

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
                "transcript": processed["text"],
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
            "transcript": processed["text"],
        }
