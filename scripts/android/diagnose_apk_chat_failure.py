#!/usr/bin/env python3
"""Compatibility entry point; the maintained implementation is parallel_failure_triage.py."""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).with_name("parallel_failure_triage.py")), run_name="__main__")
