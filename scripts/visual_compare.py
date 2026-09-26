#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
THRESHOLD=0.085
for name in ("desktop","mobile"):
    base=Path(f"qa/baseline/{name}.png"); cur=Path(f"qa/current/{name}.png")
    if not cur.exists(): raise SystemExit(f"Missing screenshot: {cur}")
    if not base.exists():
        print(f"BASELINE NOT PRESENT: {base}")
        continue
    a=Image.open(base).convert("RGB"); b=Image.open(cur).convert("RGB")
    if a.size != b.size: raise SystemExit(f"VISUAL REGRESSION: {name} size changed")
    stat=ImageStat.Stat(ImageChops.difference(a,b))
    score=sum(stat.mean)/(3*255)
    print(f"{name}: visual difference={score:.4f}")
    if score > THRESHOLD: raise SystemExit(f"VISUAL REGRESSION: {name} exceeded {THRESHOLD:.3f}")
print("VISUAL COMPARISON: PASS")
