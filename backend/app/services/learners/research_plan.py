import json
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.clients import service_call
from app.core.learning import enrich_resource
from app.core.skills import skills_in
from app.contracts.schemas import ResearchAdoption
from .database import db
from .dependencies import learner
from .models import Learner, PlanRevision

router = APIRouter()


@router.post("/me/research-plan")
async def adopt(
    body: ResearchAdoption,
    request: Request,
    row: Learner = Depends(learner),
    session: Session = Depends(db),
):
    result = (
        await service_call("matching", f"/research/{body.research_id}", request)
    ).json()
    if result.get("status") != "complete":
        raise HTTPException(409, "Finish the research before using this plan.")
    guide = result["result"]
    profile = json.loads(row.profile)
    if guide["goal"] != profile.get("goal"):
        raise HTTPException(
            409, "Your goal changed. Research your current goal before using this plan."
        )
    if any(w["minutes"] > profile.get("hours", 3) * 60 for w in guide["weeks"]):
        raise HTTPException(
            409, "Your available time changed. Run research again to match your pace."
        )
    resources = [
        enrich_resource(
            {
                "id": r["id"],
                "title": r["title"],
                "provider": r["provider"],
                "url": r["url"],
                "format": r["format"],
                "cost": "Free learning content. " + r["access_note"],
                "device": "phone or laptop",
                "review": r["why_it_fits"],
                "skills": skills_in(
                    r["skill"] + " " + r["title"] + " " + r["why_it_fits"]
                )
                or [r["skill"]],
            }
        )
        for r in guide["resources"]
    ]
    if json.loads(row.plan):
        session.add(
            PlanRevision(
                id=secrets.token_hex(16),
                learner_id=row.id,
                payload=json.dumps(
                    {
                        "at": datetime.now(timezone.utc).isoformat(),
                        "reason": "Replaced with a web-researched plan",
                        "plan": json.loads(row.plan),
                        "progress": json.loads(row.progress),
                    }
                ),
            )
        )
    row.plan = json.dumps(
        {
            "id": secrets.token_hex(16),
            "title": guide["title"],
            "outcome": guide["orientation"],
            "weeks": guide["weeks"],
            "resources": resources,
            "research_id": body.research_id,
            "research_guide": guide,
            "engine": "OpenAI + web search",
            "notice": guide["notice"],
        }
    )
    row.progress = "{}"
    session.commit()
    return {"saved": True}
