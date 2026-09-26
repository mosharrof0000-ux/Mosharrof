"""Context-aware Mosharrof voice processing with explicit authorization.

Speech-to-text is an external boundary. This engine provides conservative
transcript cleanup, contextual correction and smart punctuation. It never
pretends to decode raw audio without an authorized transcription provider.
"""

import re
from typing import Any, Dict, Iterable, Optional, Sequence, Callable
from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    """Voice journal boundary plus context-aware transcript intelligence."""

    DEFAULT_CORRECTIONS = {
        "গবেষনা": "গবেষণা",
        "প্রজেকট": "প্রজেক্ট",
        "খুজে": "খুঁজে",
        "খুজুন": "খুঁজুন",
        "কোরান": "কুরআন",
        "কুরান": "কুরআন",
        "কুরআন গবেষনা": "কুরআন গবেষণা",
        "করতেছ": "করছ",
        "করতেছেন": "করছেন",
        "মশারফ": "মোশাররফ",
        "মোশরফ": "মোশাররফ",
        "মোশররফ": "মোশাররফ",
        "মোশারফ": "মোশাররফ",
        "মোশারফ এর": "মোশাররফের",
        "মোশাররফ এর": "মোশাররফের",
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
        self.correction_map = dict(self.DEFAULT_CORRECTIONS)
        if correction_map:
            self.correction_map.update(correction_map)
        self.transcription_provider = transcription_provider

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
    def _clean_spacing(text: str) -> str:
        text = re.sub(r"[ \t]+", " ", text.strip())
        text = re.sub(r"\s+([,।?!])", r"\1", text)
        text = re.sub(r",+", ",", text)
        return text

    def apply_smart_punctuation(
        self,
        raw_text: str,
        pause_boundaries: Optional[Sequence[int]] = None,
        question_hint: Optional[bool] = None,
    ) -> str:
        """Add conservative punctuation to a transcript."""
        text = self._clean_spacing(raw_text or "")
        if not text:
            return ""

        text = re.sub(r"\s*\[pause\]\s*", "। ", text, flags=re.IGNORECASE)
        if pause_boundaries:
            for offset in sorted(pause_boundaries, reverse=True):
                if 0 < offset < len(text):
                    text = text[:offset].rstrip() + ", " + text[offset:].lstrip()

        if not re.search(r"[?!।]$", text):
            question_starts = ("কি ", "কী ", "কেন ", "কীভাবে ", "কিভাবে ", "কোথায় ", "কোথায় ", "কখন ", "কে ", "কোন ", "কত ")
            words = [word.strip(".,!?।") for word in text.split()]
            recent_question_words = set(words[-4:]).intersection(
                {word.strip() for word in ("কি", "কী", "কেন", "কীভাবে", "কিভাবে", "কোথায়", "কোথায়", "কখন", "কে", "কোন", "কত")}
            )
            inferred_question = (
                text.startswith(question_starts)
                or text.endswith((" কি", " কী", " কেন", " কীভাবে", " কিভাবে"))
                or bool(recent_question_words)
            )
            if question_hint is True or inferred_question:
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

    @staticmethod
    def _looks_like_question(text: str) -> bool:
        prefixes = (
            "কি ", "কী ", "কেন ", "কখন ", "কোথায় ", "কোথায় ",
            "কীভাবে ", "কিভাবে ", "what ", "why ", "when ", "where ",
            "who ", "how ", "is ", "are ", "am ", "do ", "does ",
            "did ", "can ", "could ", "would ", "will ", "shall "
        )
        lowered = text.casefold()
        return any(lowered.startswith(prefix.casefold()) for prefix in prefixes)

    def correct_contextual_grammar(
        self,
        raw_text: str,
        context: Optional[Iterable[str]] = None,
    ) -> str:
        """Apply only explicit, conservative transcript corrections."""
        text = self._clean_spacing(raw_text or "")
        if not text:
            return ""

        context_text = " ".join(context or ())
        for source, target in sorted(self.correction_map.items(), key=lambda item: -len(item[0])):
            pattern = rf"(?<!\S){re.escape(source)}(?!\S)"
            if context_text or source in self.correction_map:
                text = re.sub(pattern, target, text)
        return text

    def sanitize_phonetic_speech(
        self,
        audio_stream: Any,
        *,
        transcript: Optional[str] = None,
        context: Optional[Iterable[str]] = None,
    ) -> Dict[str, Any]:
        """Convert an authorized provider result into a cleaned transcript."""
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}

        if transcript is None:
            if isinstance(audio_stream, str):
                transcript = audio_stream
            elif self.transcription_provider is not None:
                transcript = self.transcription_provider(audio_stream)
            else:
                return {"status": "UNAVAILABLE", "reason": "SPEECH_RECOGNITION_ADAPTER_REQUIRED"}

        if not isinstance(transcript, str) or not transcript.strip():
            return {"status": "EMPTY", "reason": "NO_TRANSCRIPT"}

        corrected = self.correct_contextual_grammar(transcript, context=context)
        punctuated = self.apply_smart_punctuation(corrected)
        self.ledger.record_event("VOICE_TRANSCRIPT_PROCESSED", {
            "raw_text": transcript,
            "corrected_text": corrected,
            "final_text": punctuated,
        })
        return {
            "status": "SUCCESS",
            "raw_text": transcript,
            "corrected_text": corrected,
            "sanitized_text": punctuated,
            "text": punctuated,
            "stt_provider": "EXTERNAL_BOUNDARY",
        }

    def process_voice_text(self, transcript: str, *, context: Optional[Iterable[str]] = None) -> Dict[str, Any]:
        """Process already-transcribed voice text without requiring audio access."""
        corrected = self.correct_contextual_grammar(transcript, context=context)
        final_text = self.apply_smart_punctuation(corrected)
        return {"status": "SUCCESS" if final_text else "EMPTY",
                "corrected_text": corrected, "final_text": final_text}

    def process_voice_transcript(self, transcript: str, *, context: Optional[Iterable[str]] = None) -> Dict[str, Any]:
        return self.process_voice_text(transcript, context=context)

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}

        processed = self.process_voice_text(transcript)
        speaker_info = self.identify_speaker(speaker_signature)
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", {
            "speaker": speaker_info["speaker"],
            "transcript": processed["final_text"],
            "raw_transcript": transcript,
            "is_known_person": speaker_info["is_known"],
            "privacy_status": "LOCAL_ONLY",
            "voice_processing": "CONTEXT_AWARE",
        })
        return {"status": "SUCCESS", "detected_speaker": speaker_info["speaker"],
                "is_known": speaker_info["is_known"],
                "transcript": processed["final_text"]}
