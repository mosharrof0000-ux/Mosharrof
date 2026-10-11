import io

import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

import main


client = TestClient(main.app)


def test_health_does_not_expose_secrets_or_audio():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "mosharrof-personal-voice"
    assert data["audio_persistence"] is False
    assert "token" not in data
    assert "HF_TOKEN" not in data


def test_synthesis_requires_auth_before_model_load(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", "test-secret")
    monkeypatch.setattr(main, "_model", None)

    audio_buffer = io.BytesIO()
    sf.write(audio_buffer, np.zeros(8000, dtype=np.float32), 8000, format="WAV")
    audio_buffer.seek(0)

    response = client.post(
        "/synthesize",
        data={"text": "বাংলা পরীক্ষা", "reference_text": "এটি একটি পরীক্ষা"},
        files={"reference_audio": ("sample.wav", audio_buffer.getvalue(), "audio/wav")},
    )
    assert response.status_code == 401
    assert main._model is None


def test_unconfigured_service_does_not_load_model(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", "")
    monkeypatch.setattr(main, "MODEL_REVISION", "")
    monkeypatch.setattr(main, "HF_TOKEN", "")
    monkeypatch.setattr(main, "_model", None)

    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["configured"] is False
    assert response.json()["model_loaded"] is False
