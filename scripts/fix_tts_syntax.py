#!/usr/bin/env python3
from pathlib import Path
TARGET = Path(__file__).resolve().parents[1] / "web" / "index.html"
html = TARGET.read_text(encoding="utf-8")
bad = "if(cleanareturn clean;"
good = "if(clean)return clean;"
if bad not in html:
    if good in html:
        print("already fixed")
        raise SystemExit(0)
    raise SystemExit("expected corruption marker not found")
html = html.replace(bad, good, 1)
if "showDownloadButton" not in html:
    raise SystemExit("download feature missing after fix")
TARGET.write_text(html, encoding="utf-8")
print("syntax fixed OK")
