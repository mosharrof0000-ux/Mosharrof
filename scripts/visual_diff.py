import sys
from PIL import Image,ImageChops,ImageStat
a=Image.open(sys.argv[1]).convert("RGB"); b=Image.open(sys.argv[2]).convert("RGB")
if a.size!=b.size: raise SystemExit(f"VISUAL FAIL: size changed {a.size} -> {b.size}")
d=ImageChops.difference(a,b); stat=ImageStat.Stat(d)
mean=sum(stat.mean)/3
changed=sum(1 for p in d.resize((128,128)).getdata() if max(p)>18)/(128*128)
print(f"mean={mean:.2f} changed={changed:.2%}")
if mean>52 or changed>0.72: raise SystemExit("VISUAL FAIL: substantial regression")
