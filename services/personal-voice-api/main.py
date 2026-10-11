"""Isolated, opt-in personal voice inference API.

This service is intentionally separate from the Mosharrof Cloudflare Worker.
It does not persist uploaded audio. Model loading is lazy and requires an
operator-reviewed, pinned model revision plus explicit secrets.
"""
from __future__ import annotations

import hmac
import io
import os
import tempfile
import threading
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response

app = FastAPI(title="Mosharrof Personal Voice API", version="0.1.0-prototype")

MODEL_ID = os.getenv("INDICF5_MODEL_ID", "ai4bharat/IndicF5")
MODEL_REVISION = os.getenv("INDICF5_MODEL_REVISION", "").strip()
API_TOKEN = os.getenv("PERSONAL_VOICE_API_TOKEN", "")
HF_TOKEN = os.getenv("HF_TOKEN", "")
MAX_AUDIO_BYTES = int(os.getenv("MAX_REFERENCE_AUDIO_BYTES", str(5 * 1024 * 1024)))
MAX_AUDIO_SECONDS = int(os.getenv("MAX_REFERENCE_AUDIO_SECONDS", "20"))
MAX_TEXT_CHARS = int(os.getenv("MAX_SYNTHESIS_TEXT_CHARS", "800"))
MAX_REFERENCE_TEXT_CHARS = int(os.getenv("MAX_REFERENCE_TEXT_CHARS", "500"))

_model: Any = None
_model_lock = threading.Lock()


def _is_configured() -> bool:
    # Requiring an explicit revision prevents silently following a moving model branch.
    return bool(API_TOKEN and MODEL_REVISION and HF_TOKEN)


def _authorize(authorization: str | None) -> None:
    if not API_TOKEN:
        raise HTTPException(status_code=503, detail="Personal voice service is not configured")
    expected = f"Bearer {API_TOKEN}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


def _get_model() -> Any:
    global _model
    if _model is not None:
        return _model
    if not _is_configured():
        raise HTTPException(status_code=503, detail="Personal voice service is not configured")
    with _model_lock:
        if _model is None:
            # Model code is enabled only for an operator-reviewed, pinned revision.
            # Never point INDICF5_MODEL_REVISION at an unreviewed moving branch.
            try:
                from transformers import AutoModel

                _model = AutoModel.from_pretrained(
                    MODEL_ID,
                    revision=MODEL_REVISION,
                    token=HF_TOKEN,
                    trust_remote_code=True,
                )
                if hasattr(_model, "eval"):
                    _model.eval()
            except Exception as exc:
                # Do not return raw exception text: it can leak local paths or config.
                raise HTTPException(
                    status_code=503,
                    detail="Voice model could not be loaded; use the existing TTS fallback",
                ) from exc
    return _model


@app.get("/health")
def health() -> dict[str, Any]:
    """Return safe readiness metadata; never disclose tokens or user data."""
    return {
        "ok": True,
        "service": "mosharrof-personal-voice",
        "provider": "IndicF5",
        "mode": "prototype",
        "configured": _is_configured(),
        "model_loaded": _model is not None,
        "audio_persistence": False,
    }


@app.post("/synthesize")
async def synthesize(
    text: str = Form(...),
    reference_text: str = Form(...),
    reference_audio: UploadFile = File(...),
    authorization: str | None = Header(default=None),
) -> Response:
    """Create one WAV from a user-authorized reference clip; no profile is stored."""
    _authorize(authorization)

    text = text.strip()
    reference_text = reference_text.strip()
    if not text or len(text) > MAX_TEXT_CHARS:
        raise HTTPException(status_code=400, detail=f"text must be 1–{MAX_TEXT_CHARS} characters")
    if not reference_text or len(reference_text) > MAX_REFERENCE_TEXT_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"reference_text must be 1–{MAX_REFERENCE_TEXT_CHARS} characters",
        )
    if reference_audio.content_type not in {
        "audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave",
        "audio/flac", "audio/ogg", "application/octet-stream",
    }:
        raise HTTPException(status_code=415, detail="Unsupported reference audio content type")

    raw = await reference_audio.read(MAX_AUDIO_BYTES + 1)
    if not raw or len(raw) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Reference audio is empty or exceeds size limit")

    # Decode and validate before passing a temporary file to the model.
    try:
        samples, sample_rate = sf.read(io.BytesIO(raw), dtype="float32", always_2d=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Reference audio could not be decoded") from exc
    duration = len(samples) / float(sample_rate)
    if sample_rate <= 0 or duration <= 0 or duration > MAX_AUDIO_SECONDS:
        raise HTTPException(
            status_code=400,
            detail=f"Reference audio must be at most {MAX_AUDIO_SECONDS} seconds",
        )
    if samples.shape[1] > 2 or not np.isfinite(samples).all():
        raise HTTPException(status_code=400, detail="Invalid audio channels or samples")

    model = _get_model()
    temp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            temp_path = tmp.name
            sf.write(tmp, samples, sample_rate, format="WAV")
        audio = model(text, ref_audio_path=temp_path, ref_text=reference_text)
        audio = np.asarray(audio)
        if audio.dtype == np.int16:
            audio = audio.astype(np.float32) / 32768.0
        else:
            audio = audio.astype(np.float32, copy=False)
        if audio.size == 0 or not np.isfinite(audio).all():
            raise HTTPException(status_code=502, detail="Voice model returned invalid audio")
        output = io.BytesIO()
        sf.write(output, audio, samplerate=24000, format="WAV", subtype="PCM_16")
        return Response(
            content=output.getvalue(),
            media_type="audio/wav",
            headers={
                "Cache-Control": "no-store",
                "X-Voice-Provider": "IndicF5",
                "X-Voice-Mode": "reference-conditioned-prototype",
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Voice synthesis failed; use existing TTS fallback") from exc
    finally:
        if temp_path:
            try:
                Path(temp_path).unlink(missing_ok=True)
            except OSError:
                pass
        await reference_audio.close()
