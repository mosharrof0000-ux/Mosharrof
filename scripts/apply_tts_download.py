#!/usr/bin/env python3
from pathlib import Path
import base64
ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "web" / "index.html"
html = TARGET.read_text(encoding="utf-8")
if "showDownloadButton" in html:
    print("already applied"); raise SystemExit(0)
OLD_CSS = (
    ".message-speak-shortcut{display:inline-grid;place-items:center;width:28px;height:26px;padding:0;"
    "border:1px solid rgba(255,255,255,.18);border-radius:8px;background:#080808;color:#f2f2f2}"
    ".message-speak-shortcut svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;"
    "stroke-linecap:round;stroke-linejoin:round}.message-speak-shortcut:active{background:#303030}"
)
NEW_CSS = (
    ".message-speak-shortcut,.message-download-shortcut{display:inline-grid;place-items:center;width:28px;height:26px;padding:0;"
    "border:1px solid rgba(255,255,255,.18);border-radius:8px;background:#080808;color:#f2f2f2}"
    ".message-speak-shortcut svg,.message-download-shortcut svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;"
    "stroke-linecap:round;stroke-linejoin:round}"
    ".message-speak-shortcut:active,.message-download-shortcut:active{background:#303030}"
)
if OLD_CSS not in html: raise SystemExit("CSS marker not found")
html = html.replace(OLD_CSS, NEW_CSS, 1)
OLD_ICON = (
    'share:\'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/>'
    '<circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/>\'};'
)
NEW_ICON = (
    'share:\'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/>'
    '<circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/>\','
    'download:\'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>\'};'
)
if OLD_ICON not in html: raise SystemExit("icon marker not found")
html = html.replace(OLD_ICON, NEW_ICON, 1)
payload = ROOT / "scripts" / "tts_nb"
b64 = "".join(p.read_text().strip() for p in sorted(payload.glob("nb_*.b64")))
new_block = base64.b64decode(b64).decode("utf-8")
start = html.find("  function setSpeakButton")
end = html.find("  function parseImageSpec")
if start < 0 or end < 0 or end <= start: raise SystemExit("speak markers missing")
html = html[:start] + new_block + html[end:]
if "showDownloadButton" not in html: raise SystemExit("apply failed")
TARGET.write_text(html, encoding="utf-8")
print("applied OK", len(html))
