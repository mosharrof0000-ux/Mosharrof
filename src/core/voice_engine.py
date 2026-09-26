"""Context-aware voice processing with explicit recording authorization.

The engine intentionally separates speech-to-text from text intelligence:
- the browser/device ASR produces transcript text;
- this engine normalizes punctuation and conservative contextual corrections;
- raw audio bytes are not silently interpreted without an ASR adapter.
"""
from typing import Any, Dict, Mapping, Optional, Union
import re
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

    def apply_smart_punctuation(self, raw_text: str) -> str:
        """Add conservative punctuation without inventing sentence content.

        Newline/long-pause separators are treated as sentence boundaries.
        Existing punctuation is preserved.
        """
        text = (raw_text or "").strip()
        if not text:
            return ""
        chunks = re.split(r"(?:\n+|\s{3,})", text)
        punctuated = [self._punctuate_sentence(chunk) for chunk in chunks]
        return " ".join(item for item in punctuated if item)

    def correct_contextual_grammar(
        self,
        raw_text: str,
        correction_map: Optional[Mapping[str, str]] = None,
    ) -> Dict[str, Any]:
        """Apply only explicit/safe corrections and report every change.

        A future language-model adapter can supply correction_map; the engine
        never hides a model-generated correction from the audit result.
        """
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return {"text": "", "corrections": []}

        corrections = []
        mapping = dict(correction_map or {})
        # Conservative speech-to-text cleanup that does not change meaning.
        mapping.update({
            "কেমনন": "কেমন",
            "আছন": "আছেন",
            "করতেছ": "করছেন",
            "করতেছে": "করছে",
        })

        corrected = text
        for wrong, right in sorted(mapping.items(), key=lambda item: len(item[0]), reverse=True):
            updated = re.sub(rf"(?<!\S){re.escape(wrong)}(?!\S)", right, corrected)
            if updated != corrected:
                corrections.append({"from": wrong, "to": right})
                corrected = updated

        # Collapse accidental repeated adjacent words.
        repeated = re.compile(r"(?P<word>\S+)(?:\s+\1){1,}", re.IGNORECASE)
        deduped = repeated.sub(r"\g<word>", corrected)
        if deduped != corrected:
            corrections.append({"type": "repeated_word", "from": corrected, "to": deduped})
            corrected = deduped

        return {"text": corrected, "corrections": corrections}

    def sanitize_phonetic_speech(
        self,
        audio_stream: Union[str, bytes, bytearray, Mapping[str, Any]],
    ) -> Dict[str, Any]:
        """Normalize an ASR transcript; require an ASR adapter for raw audio."""
        if isinstance(audio_stream, Mapping):
            transcript = str(audio_stream.get("transcript", "") or "")
        elif isinstance(audio_stream, str):
            transcript = audio_stream
        else:
            return {
                "status": "ASR_ADAPTER_REQUIRED",
                "message": "Raw audio requires a speech-to-text adapter before text sanitization.",
            }

        if not transcript.strip():
            return {"status": "EMPTY", "text": "", "corrections": []}

        corrected = self.correct_contextual_grammar(transcript)
        final_text = self.apply_smart_punctuation(corrected["text"])
        return {
            "status": "SUCCESS",
            "text": final_text,
            "corrections": corrected["corrections"],
            "pipeline": ["ASR_TRANSCRIPT", "CONTEXTUAL_CORRECTION", "SMART_PUNCTUATION"],
        }

    def process_voice_transcript(self, transcript: str) -> Dict[str, Any]:
        """Public text pipeline used by UI/ASR adapters."""
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
            "corrections": processed.get("corrections", []),
        }
