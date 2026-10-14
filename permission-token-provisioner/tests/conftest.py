"""Make the isolated project's src package importable when repository-wide pytest runs."""
from pathlib import Path
import sys

PROJECT_SRC = Path(__file__).resolve().parents[1] / "src"
if str(PROJECT_SRC) not in sys.path:
    sys.path.insert(0, str(PROJECT_SRC))
