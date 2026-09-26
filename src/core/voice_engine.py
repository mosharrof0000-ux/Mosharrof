"""Context-aware Mosharrof voice processing with explicit recording authorization.

Speech-to-text is an external provider boundary. This engine owns authorization,
transcript cleanup, conservative punctuation, contextual correction and audit
records; it does not pretend to decode raw audio by itself.
"""

import re
from typing import Any, Callable, Dict, Iterable, Optional, Sequence
from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    """Voice journal boundary plus conservative transcript intelligence."""

    DEFAULT_CORRECTIONS = {
        "গবেষনা": "গবেষণা",
        "প্রজেকট": "প্রজেক্ট",
        "খুজে": "খুঁজে",
        "খুজুন": "খুঁজুন",
        "করতেছ": "করছ",
    }

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
        """Apply conservative punctuation to transcript text.

        A provider can supply [pause] markers or timing metadata. When no
        acoustic information is available, the engine defaults to a sentence
        stop rather than guessing a question from a word such as 'কি' appearing
        inside the sentence.
        """
        text = self._clean_spacing(raw_text or "")
        if not text:
            return ""

        text = re.sub(r"\s*\[pause\]\s*", "। ", text, flags=re.IGNORECASE)

        if not re.search(r"[?!।]$", text):
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

        Unknown speech is preserved. A caller may supply context to extend the
        correction pass with a task-specific correction map.
        """
        text = self._clean_spacing(raw_text or "")
        if not text:
            return ""

        context_text = " ".join(context or ())
        for source, target in self.correction_map.items():
            pattern = rf"(?<!\S){re.escape(source)}(?!\S)"
            if context_text or source in self.DEFAULT_CORRECTIONS:
                text = re.sub(pattern, target, text)
        return text

    def process_voice_text(
        self,
        transcript: str,
        *,
        context: Optional[Iterable[str]] = None,
    ) -> Dict[str, Any]:
        """Process already-transcribed speech."""
        corrected = self.correct_contextual_grammar(transcript, context=context)
        final_text = self.apply_smart_punctuation(corrected)
        return {
            "status": "SUCCESS" if final_text else "EMPTY",
            "raw_text": transcript,
            "corrected_text": corrected,
            "final_text": final_text,
        }

    def process_voice_transcript(
        self,
        transcript: str,
        *,
        context: Optional[Iterable[str]] = None,
    ) -> Dict[str, Any]:
        """Backward-compatible alias for text transcript processing."""
        result = self.process_voice_text(transcript, context=context)
        return {
            **result,
            "text": result["final_text"],
            "stt_provider": "EXTERNAL_BOUNDARY",
        }

    def sanitize_phonetic_speech(
        self,
        audio_stream: Any,
        *,
        transcript: Optional[str] = None,
        context: Optional[Iterable[str]] = None,
    ) -> Dict[str, Any]:
        """Authorize audio processing and normalize provider transcription."""
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}

        raw_text = transcript
        if raw_text is None:
            if isinstance(audio_stream, str):
                raw_text = audio_stream
            elif self.transcription_provider is not None:
                raw_text = self.transcription_provider(audio_stream)
            else:
                return {
                    "status": "UNAVAILABLE",
                    "reason": "TRANSCRIPTION_PROVIDER_NOT_CONFIGURED",
                }

        if not isinstance(raw_text, str) or not raw_text.strip():
            return {"status": "EMPTY", "reason": "NO_TRANSCRIPT"}

        processed = self.process_voice_text(raw_text, context=context)
        return {
            "status": processed["status"],
            "raw_text": raw_text,
            "corrected_text": processed["corrected_text"],
            "sanitized_text": processed["final_text"],
            "text": processed["final_text"],
            "stt_provider": (
                "INJECTED_PROVIDER" if self.transcription_provider is not None
                and transcript is None and not isinstance(audio_stream, str)
                else "TEXT_BOUNDARY"
            ),
        }

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}

        processed = self.process_voice_text(transcript)
        speaker_info = self.identify_speaker(speaker_signature)
        self.ledger.record_event(
            "SOCIAL_INTERACTION_LOGGED",
            {
                "speaker": speaker_info["speaker"],
                "transcript": processed["final_text"],
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
            "transcript": processed["final_text"],
        }
