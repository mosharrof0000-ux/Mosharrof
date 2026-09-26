"""Context-aware voice processing with explicit recording authorization.

Speech-to-text is provider-specific. The engine owns the text intelligence
boundary: conservative contextual correction, smart punctuation, and audit.
"""

from typing import Any, Callable, Dict, Mapping, Optional, Union
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
    def _punctuate_sentence(sentence: str) -> str:
        text = re.sub(r"\s+", " ", sentence).strip()
        if not text:
            return ""
        if text[-1] in "।?!,;:":
            return text
        question_endings = (
            "কি", "কী", "কেন", "কোথায়", "কোথায়", "কখন", "কীভাবে",
            "কিভাবে", "কত", "কার", "কে", "কোন", "কোনটি", "হবে কি",
        )
        if any(text.endswith(word) for word in question_endings):
            return text + "?"
        return text + "।"

    @classmethod
    def apply_smart_punctuation(cls, raw_text: str) -> str:
        """Add conservative punctuation without inventing sentence content."""
        text = (raw_text or "").strip()
        if not text:
            return ""
        text = re.sub(r"\s+([,।!?])", r"\1", text)
        text = re.sub(r",+", ",", text)
        text = re.sub(r"!+", "!", text)
        text = re.sub(r"\?+", "?", text)
        text = re.sub(r"।+", "।", text)
        chunks = re.split(r"(?:\n+|\s{3,})", text)
        return " ".join(cls._punctuate_sentence(chunk) for chunk in chunks if chunk.strip())

    @staticmethod
    def _contextual_correction_result(
        raw_text: str,
        correction_map: Optional[Mapping[str, str]] = None,
    ) -> Dict[str, Any]:
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return {"text": "", "corrections": []}

        corrections = []
        mapping = {
            "কেমনন": "কেমন",
            "আছন": "আছেন",
            "করতেছ": "করছ",
            "করতেছে": "করছে",
            "করতেছেন": "করছেন",
            "যাইতেছি": "যাচ্ছি",
            "আসতেছি": "আসছি",
            "করবেনা": "করবে না",
        }
        if correction_map:
            mapping.update(dict(correction_map))

        corrected = text
        for wrong, right in sorted(mapping.items(), key=lambda item: len(item[0]), reverse=True):
            updated = re.sub(rf"(?<!\S){re.escape(wrong)}(?!\S)", right, corrected)
            if updated != corrected:
                corrections.append({"from": wrong, "to": right})
                corrected = updated

        repeated = re.compile(r"(?P<word>\S+)(?:\s+\1){1,}", re.IGNORECASE)
        deduped = repeated.sub(r"\g<word>", corrected)
        if deduped != corrected:
            corrections.append({"type": "repeated_word", "from": corrected, "to": deduped})
            corrected = deduped
        return {"text": corrected, "corrections": corrections}

    def correct_contextual_grammar(self, raw_text: str, context: str = "") -> str:
        """Backward-compatible text correction returning only corrected text."""
        return self._contextual_correction_result(raw_text)["text"]

    def sanitize_phonetic_speech(
        self,
        audio_stream: Union[str, bytes, bytearray, Mapping[str, Any]],
    ) -> Dict[str, Any]:
        """Process transcript text or authorized raw audio through an ASR provider."""
        if isinstance(audio_stream, Mapping):
            transcript = str(audio_stream.get("transcript", "") or "")
        elif isinstance(audio_stream, str):
            transcript = audio_stream
        else:
            if not self.recording_authorized:
                return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
            if self.transcription_provider is None:
                return {
                    "status": "UNAVAILABLE",
                    "reason": "NO_TRANSCRIPTION_PROVIDER_ATTACHED",
                }
            transcript = self.transcription_provider(audio_stream)

        if not transcript.strip():
            return {"status": "EMPTY", "text": "", "corrections": []}

        corrected = self._contextual_correction_result(transcript)
        final_text = self.apply_smart_punctuation(corrected["text"])
        return {
            "status": "SUCCESS",
            "text": final_text,
            "corrections": corrected["corrections"],
            "raw_transcript": transcript,
            "sanitized_text": final_text,
            "pipeline": ["ASR_TRANSCRIPT", "CONTEXTUAL_CORRECTION", "SMART_PUNCTUATION"],
        }

    def process_voice_text(self, raw_text: str, context: str = "") -> Dict[str, Any]:
        """Backward-compatible transcript pipeline."""
        corrected = self._contextual_correction_result(raw_text)
        punctuated = self.apply_smart_punctuation(corrected["text"])
        return {
            "status": "SUCCESS" if punctuated else "EMPTY",
            "raw_text": raw_text,
            "corrected_text": corrected["text"],
            "final_text": punctuated,
            "corrections": corrected["corrections"],
        }

    def process_voice_transcript(self, transcript: str) -> Dict[str, Any]:
        """Public text pipeline used by browser/device ASR adapters."""
        return self.sanitize_phonetic_speech(transcript)

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        processed = self.process_voice_transcript(transcript)
        speaker_info = self.identify_speaker(speaker_signature)
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", {
            "speaker": speaker_info["speaker"],
            "transcript": processed.get("text", transcript),
            "corrections": processed.get("corrections", []),
            "is_known_person": speaker_info["is_known"],
            "privacy_status": "LOCAL_ONLY",
        })
        return {
            "status": "SUCCESS",
            "detected_speaker": speaker_info["speaker"],
            "is_known": speaker_info["is_known"],
            "text": processed.get("text", transcript),
            "normalized_transcript": processed.get("text", transcript),
            "corrections": processed.get("corrections", []),
        }
