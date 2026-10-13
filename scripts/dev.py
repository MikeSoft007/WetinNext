#!/usr/bin/env python3
"""Run independently addressable services locally; terminate all children on exit."""

from pathlib import Path
import os
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / "backend/.venv/bin/python"
SERVICES = [
    ("gateway", "app.main:app", 8000),
    ("learner", "app.services.learners.main:app", 8001),
    ("catalog", "app.services.catalog.main:app", 8002),
    ("matching", "app.services.matching.main:app", 8003),
]
children = []


def stop(*_):
    for child in children:
        if child.poll() is None:
            child.terminate()
    for child in children:
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
    sys.exit(0)


if not PYTHON.exists():
    sys.exit("Create backend/.venv and install backend/requirements.txt first.")
signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)
try:
    for name, module, port in SERVICES:
        child = subprocess.Popen(
            [
                str(PYTHON),
                "-m",
                "uvicorn",
                module,
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
            ],
            cwd=ROOT / "backend",
            env=os.environ.copy(),
        )
        children.append(child)
        print(f"{name}: http://127.0.0.1:{port}/api/v1/docs", flush=True)
    while True:
        if any(child.poll() is not None for child in children):
            print("A service exited. Stopping the local stack.", flush=True)
            stop()
        time.sleep(0.5)
finally:
    stop()
