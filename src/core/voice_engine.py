"""Context-aware voice journal processing with explicit recording authorization.

The engine keeps acoustic speech recognition provider-agnostic. Text produced by an
external speech-to-text adapter can be normalized with smart punctuation and
conservative context correction. Raw audio is never silently guessed or rewritten.
"""

import re
from difflib import get_close_matches
from typing import Any, Dict, Iterable, Optional

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
    def apply_smart_punctuation(raw_text: str, pause_hints: Optional[Iterable[int]] = None) -> str:
        """Normalize transcript text and add conservative sentence punctuation.

        pause_hints contains optional character positions supplied by an acoustic
        layer. Without acoustic metadata, punctuation is inferred from language
        cues only; the engine never claims to have heard intonation it did not get.
        """
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""

        text = re.sub(r"\s+([,!?।])", r"\1", text)
        text = re.sub(r"([,!?।])(?=\S)", r"\1 ", text)

        # Respect explicit punctuation already supplied by the speech-to-text layer.
        if text[-1] in "।!?":
            return text

        question_starts = (
            "কি ", "কী ", "কেন ", "কখন ", "কোথায় ", "কোথায় ",
            "কোথা থেকে ", "কে ", "কাকে ", "কার ", "কোন ",
            "কত ", "আপনি কি ", "তুমি কি ", "এটা কি ",
        )
        lowered = text.casefold()
        if lowered.startswith(question_starts):
            return text + "?"

        # A supplied pause near the end is treated as a sentence boundary.
        if pause_hints:
            try:
                last_pause = max(int(p) for p in pause_hints)
                if last_pause >= max(0, len(text) - 3):
                    return text + "।"
            except (TypeError, ValueError):
                pass

        return text + "।"

    @staticmethod
    def correct_contextual_grammar(
        raw_text: str,
        context_terms: Optional[Iterable[str]] = None,
        corrections: Optional[Dict[str, str]] = None,
    ) -> str:
        """Apply only explicit or high-confidence context corrections.

        No domain word is silently changed by default. A caller may provide an
        approved correction map, or a list of context terms for close-match repair.
        """
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""

        for wrong, right in (corrections or {}).items():
            if wrong and right:
                text = re.sub(rf"(?<!\S){re.escape(wrong)}(?!\S)", right, text)

        terms = [str(term).strip() for term in (context_terms or ()) if str(term).strip()]
        if terms:
            words = text.split(" ")
            repaired = []
            for word in words:
                bare = word.strip(".,!?।")
                if len(bare) >= 4 and bare not in terms:
                    matches = get_close_matches(bare, terms, n=1, cutoff=0.90)
                    if matches:
                        word = word.replace(bare, matches[0], 1)
                repaired.append(word)
            text = " ".join(repaired)

        # Collapse accidental repeated adjacent words without changing meaning.
        text = re.sub(r"(?u)\b(\S+)(?:\s+\1\b)+", r"\1", text, flags=re.IGNORECASE)
        return text

    def sanitize_phonetic_speech(self, audio_stream: Any) -> Dict[str, Any]:
        """Normalize STT text or explicitly request an external STT adapter.

        Actual audio-to-text conversion belongs to a model/provider adapter. Raw
        bytes are therefore not guessed or transformed into invented words.
        """
        if isinstance(audio_stream, str):
            normalized = self.apply_smart_punctuation(audio_stream)
            return {
                "status": "SUCCESS",
                "input_type": "TRANSCRIPT",
                "text": normalized,
            }
        if isinstance(audio_stream, (bytes, bytearray)):
            return {
                "status": "NEEDS_STT_ADAPTER",
                "input_type": "AUDIO",
                "reason": "A_SPEECH_TO_TEXT_PROVIDER_MUST_SUPPLY_TRANSCRIPT",
            }
        return {"status": "INVALID_INPUT", "reason": "UNSUPPORTED_AUDIO_STREAM_TYPE"}

    def process_voice_text(
        self,
        raw_text: str,
        *,
        context_terms: Optional[Iterable[str]] = None,
        corrections: Optional[Dict[str, str]] = None,
        pause_hints: Optional[Iterable[int]] = None,
    ) -> Dict[str, Any]:
        corrected = self.correct_contextual_grammar(
            raw_text, context_terms=context_terms, corrections=corrections
        )
        punctuated = self.apply_smart_punctuation(corrected, pause_hints=pause_hints)
        return {
            "status": "SUCCESS" if punctuated else "EMPTY",
            "raw_text": raw_text,
            "processed_text": punctuated,
            "correction_applied": corrected != (raw_text or "").strip(),
        }

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        speaker_info = self.identify_speaker(speaker_signature)
        processed = self.process_voice_text(transcript)
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", {
            "speaker": speaker_info["speaker"],
            "transcript": processed["processed_text"],
            "is_known_person": speaker_info["is_known"],
            "privacy_status": "LOCAL_ONLY",
        })
        return {
            "status": "SUCCESS",
            "detected_speaker": speaker_info["speaker"],
            "is_known": speaker_info["is_known"],
            "processed_text": processed["processed_text"],
        }
