"""Public validation limits used by both the Python API and React forms."""
import json
from pathlib import Path

RULES = json.loads((Path(__file__).resolve().parents[2] / 'shared' / 'validation.json').read_text(encoding='utf-8'))
