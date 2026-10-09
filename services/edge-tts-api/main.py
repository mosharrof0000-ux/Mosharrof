import hmac
import os
import re
from typing import Literal

import edge_tts
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

app = FastAPI(title="Mosharrof Edge TTS", version="1.0.0")

ALLOWED_VOICES = {"bn-BD-PradeepNeural", "bn-BD-NabanitaNeural"}
MAX_TEXT_CHARS = 12000


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_CHARS)
    voice: str = "bn-BD-PradeepNeural"
    language_code: str = "bn-BD"
    pace: float = Field(default=1.0, ge=0.5, le=1.5)
    rate: str = "+0%"
    output_format: Literal["audio/mpeg"] = "audio/mpeg"


@app.get("/health")
async def health():
    return {"ok": True, "service": "mosharrof-edge-tts", "provider": "Edge-TTS"}


@app.post("/tts")
async def synthesize(payload: TTSRequest, authorization: str | None = Header(default=None)):
    expected = os.getenv("EDGE_TTS_API_TOKEN", "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="EDGE_TTS_API_TOKEN is not configured")
    supplied = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")

    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text_required")
    voice = payload.voice if payload.voice in ALLOWED_VOICES else "bn-BD-PradeepNeural"
    rate = payload.rate.strip()
    if not re.fullmatch(r"[+-]\d{1,2}%", rate):
        rate = "+0%"
    # pace is supported as a future-facing API parameter; Edge-TTS uses a rate string.
    if rate == "+0%" and abs(payload.pace - 1.0) >= 0.05:
        rate = ("+" if payload.pace > 1 else "") + str(round((payload.pace - 1) * 100)) + "%"

    try:
        communicator = edge_tts.Communicate(text=text, voice=voice, rate=rate)
        audio = bytearray()
        async for chunk in communicator.stream():
            if chunk.get("type") == "audio":
                audio.extend(chunk.get("data", b""))
        if not audio:
            raise HTTPException(status_code=502, detail="empty_audio")
        return Response(
            content=bytes(audio),
            media_type="audio/mpeg",
            headers={"Cache-Control": "no-store", "X-TTS-Provider": "Edge-TTS"},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="edge_tts_failed") from exc
