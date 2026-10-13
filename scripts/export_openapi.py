#!/usr/bin/env python3
"""Export the running gateway schema for REST tools; no credentials required."""

import json
from pathlib import Path
from urllib.request import urlopen

root = Path(__file__).resolve().parents[1]
with urlopen("http://127.0.0.1:8000/api/v1/openapi.json", timeout=10) as response:
    schema = json.load(response)
target = root / "docs/api/openapi.json"
target.write_text(json.dumps(schema, indent=2) + "\n")
print(f"Exported {len(schema['paths'])} API paths to docs/api/openapi.json")
