from app.core.skills import skills_in, track_for, TRACKS
from app.core.learning import prefer_low_data

"""Private document extraction and explainable CV preparation guidance."""
import base64
import io
import json
import re
import zipfile
import secrets
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.search import rank, paginate
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.services.learners.database import db
from app.services.learners.dependencies import learner
from app.services.learners.models import Learner, CVReview
from app.core.clients import get_catalog

router = APIRouter(tags=["CV reviews"])
from app.contracts.schemas import CVUpload as Upload


def extract(filename, encoded):
    try:
        raw = base64.b64decode(encoded, validate=True)
    except Exception:
        raise HTTPException(422, "The upload could not be decoded.")
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(413, "Use a file smaller than 5 MB.")
    ext = Path(filename).suffix.lower()
    try:
        if ext == ".txt":
            text = raw.decode("utf-8-sig")
        elif ext == ".pdf":
            from pypdf import PdfReader

            if not raw.startswith(b"%PDF"):
                raise ValueError()
            reader = PdfReader(io.BytesIO(raw))
            if reader.is_encrypted or len(reader.pages) > 20:
                raise ValueError()
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        elif ext == ".docx":
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                if sum(i.file_size for i in archive.infolist()) > 20 * 1024 * 1024:
                    raise ValueError()
                import xml.etree.ElementTree as ET

                root = ET.fromstring(archive.read("word/document.xml"))
                text = "\n".join(
                    "".join(p.itertext())
                    for p in root.iter(
                        "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"
                    )
                )
        else:
            raise HTTPException(422, "Use PDF, DOCX, or UTF-8 TXT.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            422,
            "Unable to read this file. Use a text-based PDF, DOCX, or UTF-8 TXT; maximum 20 PDF pages.",
        )
    if len(text.strip()) < 80:
        raise HTTPException(
            422, "Not enough text was found. Scanned PDFs need OCR; try DOCX or TXT."
        )
    if len(text) > 60000:
        raise HTTPException(
            422, "Please upload a shorter CV (maximum 60,000 characters)."
        )
    return text


def review(text, goal, opportunity=None, resources=None, goal_skills=None):
    lower = text.lower()
    skills = skills_in(text)
    sections = {
        name: bool(re.search(pattern, lower))
        for name, pattern in {
            "Experience": r"experience|employment|work history",
            "Projects": r"projects?|portfolio",
            "Education": r"education|university|degree|diploma",
            "Skills": r"skills|technologies|competencies",
        }.items()
    }
    actions = []
    for name, present in sections.items():
        if not present:
            actions.append(
                {
                    "priority": "High",
                    "title": f"Make your {name.lower()} easy to find",
                    "detail": f"Add a clear {name} heading if relevant, with specific, truthful details. Detection can miss unusual headings.",
                }
            )
    if not re.search(
        r"\d+\s*(%|users|customers|hours|records|students|projects)", lower
    ):
        actions.append(
            {
                "priority": "High",
                "title": "Show the outcome of your work",
                "detail": "Rewrite one project or experience bullet as action → tool → outcome. Include numbers only when you can substantiate them.",
            }
        )
    if not re.search(r"https?://[^\s]+|github\.com/[^\s]+", lower):
        actions.append(
            {
                "priority": "Medium",
                "title": "Link to relevant evidence",
                "detail": "Add a public study reflection, portfolio or project link relevant to your goal. Explain your contribution and exclude private information.",
            }
        )
    requirements = opportunity.get("skills", []) if opportunity else []
    supported = [
        s
        for s in requirements
        if (set(skills_in(s)) & set(skills))
        or re.search(r"(?<!\w)" + re.escape(s.lower()) + r"(?!\w)", lower)
    ]
    gaps = [s for s in requirements if s not in supported]
    for skill in gaps:
        actions.append(
            {
                "priority": "High",
                "title": f"Clarify your evidence for {skill}",
                "detail": f"{skill} was not found in this CV. If you have used it, add a concrete example; otherwise choose a small learning project before claiming it.",
            }
        )
    actions.append(
        {
            "priority": "Next week",
            "title": "Prepare a focused application version",
            "detail": f"Choose two relevant examples for {goal or 'your target role'}. Explain what you did, what you learned, and what remains in progress.",
        }
    )
    track = track_for({"goal": goal})
    domain = goal_skills or (
        TRACKS[track]["skills"] if track != "foundation" else skills_in(goal)
    )
    target = (
        set(skills_in(" ".join(gaps))) if opportunity else set(domain) - set(skills)
    )
    if goal_skills:
        actions.insert(
            0,
            {
                "priority": "Your goal",
                "title": f"Show evidence for {goal[:100]}",
                "detail": "Choose an honest example connected to your active learning plan. Distinguish introductory study, work experience and any formal qualifications required.",
            },
        )
    suggested = sorted(
        [r for r in (resources or []) if set(r.get("skills", [])) & target],
        key=lambda r: len(set(r.get("skills", [])) & target),
        reverse=True,
    )[:2]
    return {
        "suggested_resources": suggested,
        "engine": "explainable text checks",
        "skills": skills,
        "sections": sections,
        "supported": supported,
        "gaps": gaps,
        "actions": actions,
        "word_count": len(text.split()),
        "notice": "Text mentions are not verified skills. Missing terms may be extraction or wording gaps. This is preparation guidance, not an eligibility or hiring decision. Original CV files and extracted previews are not sent to AI. When OpenAI is configured, derived skill mentions may be used with your goal and progress for recommendations.",
    }


@router.get("/me/cv-reviews")
def history(
    row: Learner = Depends(learner),
    session: Session = Depends(db),
    page: int | None = Query(None, ge=1, le=100000),
    page_size: int = Query(6, ge=1, le=50),
    q: str = Query("", max_length=100),
):
    rows = session.scalars(
        select(CVReview)
        .where(CVReview.learner_id == row.id)
        .order_by(CVReview.created_at.desc(), CVReview.id.desc())
    ).all()
    records = [json.loads(r.payload) for r in rows]
    return (
        paginate(
            rank(records, q, {"filename": 3, "goal": 2, "skills": 2}), page, page_size
        )
        if page
        else records[:20]
    )


@router.post("/me/cv-reviews")
def upload(
    body: Upload, row: Learner = Depends(learner), session: Session = Depends(db)
):
    text = extract(body.filename, body.content_base64)
    opportunity = None
    if body.opportunity_id:
        opportunity = next(
            (
                o
                for o in get_catalog("/opportunities")
                if o["id"] == body.opportunity_id
            ),
            None,
        )
        if not opportunity:
            raise HTTPException(404, "That opportunity is no longer published.")
    try:
        resources = prefer_low_data(get_catalog("/resources"), json.loads(row.profile))
    except HTTPException:
        resources = []
    profile = json.loads(row.profile)
    effective_goal = body.goal.strip() or profile.get("goal", "")
    plan = json.loads(row.plan) or {}
    goal_skills = None
    if effective_goal == profile.get("goal") and plan.get("research_id"):
        resources = plan.get("resources", [])
        goal_skills = [skill for r in resources for skill in r.get("skills", [])]
    result = {
        "id": secrets.token_hex(16),
        "filename": Path(body.filename).name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "goal": effective_goal,
        "opportunity_title": opportunity["title"] if opportunity else None,
        "extracted_preview": text[:2000],
        **review(text, effective_goal, opportunity, resources, goal_skills),
    }
    session.add(
        CVReview(
            id=result["id"],
            learner_id=row.id,
            payload=json.dumps(result),
            created_at=result["created_at"],
        )
    )
    session.commit()
    return result


@router.delete("/me/cv-reviews/{review_id}")
def delete(
    review_id: str, row: Learner = Depends(learner), session: Session = Depends(db)
):
    record = session.get(CVReview, review_id)
    if not record or record.learner_id != row.id:
        raise HTTPException(404, "Review not found.")
    session.delete(record)
    session.commit()
    return {"deleted": True}
