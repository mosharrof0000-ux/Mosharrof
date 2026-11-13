import io

import pytest

np = pytest.importorskip("numpy")
sf = pytest.importorskip("soundfile")
TestClient = pytest.importorskip("fastapi.testclient").TestClient

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
    monkeypatch.setattr(main, "MODEL_REVIEWED", True)
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
    monkeypatch.setattr(main, "MODEL_REVIEWED", False)
    monkeypatch.setattr(main, "_model", None)

    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["configured"] is False
    assert response.json()["model_loaded"] is False


def test_oversized_reference_audio_is_rejected_before_model_load(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", "test-secret")
    monkeypatch.setattr(main, "MAX_AUDIO_BYTES", 32)
    monkeypatch.setattr(main, "_model", None)
    response = client.post(
        "/synthesize",
        headers={"Authorization": "Bearer test-secret"},
        data={"text": "বাংলা", "reference_text": "এটি নমুনা"},
        files={"reference_audio": ("sample.wav", b"x" * 33, "audio/wav")},
    )
    assert response.status_code == 413
    assert main._model is None


def test_synthesis_uses_and_removes_temporary_reference_audio(monkeypatch):
    from pathlib import Path

    monkeypatch.setattr(main, "API_TOKEN", "test-secret")
    monkeypatch.setattr(main, "_model", None)
    paths = []

    def fake_model(text, ref_audio_path, ref_text):
        paths.append(ref_audio_path)
        assert text == "বাংলা কণ্ঠ পরীক্ষা"
        assert ref_text == "এটি আমার নমুনা"
        assert Path(ref_audio_path).is_file()
        return np.zeros(2400, dtype=np.float32)

    monkeypatch.setattr(main, "_get_model", lambda: fake_model)
    audio_buffer = io.BytesIO()
    sf.write(audio_buffer, np.zeros(8000, dtype=np.float32), 8000, format="WAV")
    response = client.post(
        "/synthesize",
        headers={"Authorization": "Bearer test-secret"},
        data={"text": "বাংলা কণ্ঠ পরীক্ষা", "reference_text": "এটি আমার নমুনা"},
        files={"reference_audio": ("sample.wav", audio_buffer.getvalue(), "audio/wav")},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("audio/wav")
    assert response.content[:4] == b"RIFF"
    assert len(paths) == 1
    assert not Path(paths[0]).exists()


def test_synthesis_rejects_unsupported_audio_type_before_model_load(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", "test-secret")
    monkeypatch.setattr(main, "_model", None)
    response = client.post(
        "/synthesize",
        headers={"Authorization": "Bearer test-secret"},
        data={"text": "বাংলা", "reference_text": "এটি নমুনা"},
        files={"reference_audio": ("sample.mp3", b"fake", "audio/mpeg")},
    )
    assert response.status_code == 415
    assert main._model is None


def test_ready_requires_worker_bearer_and_confirms_model_loaded(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", "test-secret")
    monkeypatch.setattr(main, "MODEL_REVIEWED", True)
    monkeypatch.setattr(main, "_model", object())
    monkeypatch.setattr(main, "_get_model", lambda: main._model)
    denied = client.get("/ready")
    assert denied.status_code == 401
    response = client.get("/ready", headers={"Authorization": "Bearer test-secret"})
    assert response.status_code == 200
    assert response.json()["ready"] is True
    assert response.json()["model_loaded"] is True
