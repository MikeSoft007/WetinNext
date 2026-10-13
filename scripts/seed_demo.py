#!/usr/bin/env python3
"""Seed missing local demo learners without replacing saved work."""

from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
python = root / "backend/.venv/bin/python"
if not python.exists():
    raise SystemExit("Create backend/.venv and install requirements first.")
subprocess.run(
    [str(python), "-m", "app.services.learners.seed"], cwd=root / "backend", check=True
)
