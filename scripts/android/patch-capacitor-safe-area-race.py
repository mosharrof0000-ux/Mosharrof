#!/usr/bin/env python3
"""Guard Capacitor SystemBars safe-area injection against a pre-DOM race.

Capacitor 8.5.x may evaluate this script before document.documentElement exists.
Later insets callbacks re-inject the real values, so the early call must no-op.
Fail closed if the upstream implementation changes, rather than silently skipping
the compatibility patch.
"""
from pathlib import Path

source = Path("node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/plugin/SystemBars.java")
if not source.is_file():
    raise SystemExit(f"Expected Capacitor SystemBars source not found: {source}")

text = source.read_text(encoding="utf-8")
guard = "if (document.documentElement != null) {"
if guard in text:
    print("CAPACITOR SAFE-AREA DOM GUARD: already present")
    raise SystemExit(0)

old = '''                    try {
                      document.documentElement.style.setProperty("--safe-area-inset-top", "%dpx");
                      document.documentElement.style.setProperty("--safe-area-inset-right", "%dpx");
                      document.documentElement.style.setProperty("--safe-area-inset-bottom", "%dpx");
                      document.documentElement.style.setProperty("--safe-area-inset-left", "%dpx");
                    } catch(e) { console.error('Error injecting safe area CSS:', e); }'''
new = '''                    try {
                      if (document.documentElement != null) {
                        document.documentElement.style.setProperty("--safe-area-inset-top", "%dpx");
                        document.documentElement.style.setProperty("--safe-area-inset-right", "%dpx");
                        document.documentElement.style.setProperty("--safe-area-inset-bottom", "%dpx");
                        document.documentElement.style.setProperty("--safe-area-inset-left", "%dpx");
                      }
                    } catch(e) { console.error('Error injecting safe area CSS:', e); }'''
if old not in text:
    raise SystemExit("Unsupported Capacitor SystemBars implementation; safe-area patch not applied")
source.write_text(text.replace(old, new, 1), encoding="utf-8")
patched = source.read_text(encoding="utf-8")
if guard not in patched or patched.count(guard) != 1:
    raise SystemExit("CAPACITOR SAFE-AREA DOM GUARD: verification failed")
print("CAPACITOR SAFE-AREA DOM GUARD: PASS")
