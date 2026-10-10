#!/usr/bin/env python3
"""Apply progressive TTS + auto download button into web/index.html"""
from pathlib import Path
import base64, hashlib

root = Path(__file__).resolve().parent
repo = root.parent.parent  # scripts/tts-download-payload -> repo root
parts = sorted(root.glob("chunk_*.b64"))
if not parts:
    raise SystemExit("no chunk_*.b64 files found")
b64 = "".join(p.read_text().strip() for p in parts)
data = base64.b64decode(b64)
expected = "9626d08b88806dbc81998a22ddd5a6d61e798518835456041330d55a05ec7c54"
got = hashlib.sha256(data).hexdigest()
if got != expected:
    raise SystemExit(f"hash mismatch: {got} != {expected}")
target = repo / "web" / "index.html"
target.write_bytes(data)
print(f"wrote {target} bytes={len(data)} sha256={got}")
