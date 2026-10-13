"""Idempotent explicit seed; preserves existing learner edits and personal data."""

import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.demo_accounts import ACCOUNTS
from . import database
from .models import Base, Learner, WeekWork, CheckInEvent
from .pathways import template
from .goals import save_current, goal_id


def seed():
    if not settings.demo_mode:
        raise RuntimeError("Seed accounts require demo mode.")
    Base.metadata.create_all(database.engine)
    created = []
    with Session(database.engine) as session:
        for account in ACCOUNTS:
            if account["role"] != "learner" or session.get(Learner, account["id"]):
                continue
            ada = account["country"] == "Nigeria"
            profile = {
                "name": account["name"],
                "country": account["country"],
                "goal": "Build accessible websites as a frontend developer"
                if ada
                else "Prepare for a data analyst internship",
                "career_track": "frontend" if ada else "data",
                "hours": 5,
                "device": "laptop",
                "low_data": True,
                "learner_type": "student" if ada else "self-taught",
                "background": "Synthetic demo learner: practising introductory HTML and CSS."
                if ada
                else "Synthetic demo learner: introductory spreadsheets and data analysis.",
            }
            plan = template(profile)
            plan["id"] = account["id"] + "-sprint-1"
            plan["notice"] = "Seeded sample learning sprint. " + plan.get("notice", "")
            stamp = datetime.now(timezone.utc).isoformat()
            progress = {
                "1": {
                    "status": "done",
                    "note": "Sample activity: completed an introductory exercise.",
                    "at": stamp,
                }
            }
            row = Learner(
                id=account["id"],
                profile=json.dumps(profile),
                plan=json.dumps(plan),
                progress=json.dumps(progress),
                applications="{}",
            )
            session.add(row)
            session.flush()
            session.add(
                WeekWork(
                    learner_id=row.id,
                    sprint_id=plan["id"],
                    week=1,
                    payload=json.dumps(
                        {
                            "checklist": {"learn": True, "build": True, "verify": True},
                            "reflection": "Sample evidence: I practised the basics and wrote down what to improve next.",
                            "evidence_url": "",
                            "updated_at": stamp,
                        }
                    ),
                )
            )
            session.add(
                CheckInEvent(
                    id=account["id"] + "-checkin",
                    learner_id=row.id,
                    payload=json.dumps(
                        {"week": 1, **progress["1"], "goal_id": goal_id(row)}
                    ),
                )
            )
            save_current(row, session)
            created.append(account["email"])
        session.commit()
    return created


if __name__ == "__main__":
    print("Created:", ", ".join(seed()) or "None; existing profiles preserved.")
