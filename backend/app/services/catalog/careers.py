"""Bounded ESCO career classification discovery, with cached outage fallback."""

import time
import re
import httpx
from urllib.parse import urlsplit
from fastapi import APIRouter, Query, HTTPException

router = APIRouter(tags=["Career bank"])
CACHE = {}


def normalise(data):
    results = []
    for row in data.get("_embedded", {}).get("results", []):
        skills = row.get("_links", {}).get("hasEssentialSkill", [])
        if isinstance(skills, dict):
            skills = [skills]
        source_url = row.get("_links", {}).get("self", {}).get("href", "")
        if (
            urlsplit(source_url).scheme != "https"
            or urlsplit(source_url).hostname != "ec.europa.eu"
        ):
            source_url = "https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api"
        results.append(
            {
                "id": row.get("uri", ""),
                "title": row.get("preferredLabel", {}).get("en", row.get("title", "")),
                "description": re.sub(
                    r"<[^>]*>",
                    "",
                    row.get("description", {}).get("en", {}).get("literal", ""),
                )[:1800],
                "skills": list(
                    dict.fromkeys(s.get("title", "") for s in skills if s.get("title"))
                )[:10],
                "source_url": source_url,
                "source": "European Commission · ESCO",
            }
        )
    return {
        "items": results,
        "total": data.get("total", 0),
        "notice": "Occupation definitions and skills, not local qualification requirements or current job listings.",
        "cached": False,
    }


@router.get("/careers")
async def careers(
    q: str = Query(default="", max_length=100),
    page: int = Query(default=1, ge=1, le=1000),
    refresh: bool = False,
):
    key = (q.strip().lower(), page)
    cached = CACHE.get(key)
    if cached and not refresh and time.monotonic() - cached[0] < 86400:
        return {**cached[1], "cached": True}
    try:
        params = {
            "type": "occupation",
            "language": "en",
            "limit": 6,
            "offset": page - 1,
            "full": "true",
        }
        if q.strip():
            params["text"] = q.strip()
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                "https://ec.europa.eu/esco/api/search", params=params
            )
            response.raise_for_status()
        result = normalise(response.json())
        if len(CACHE) >= 256:
            CACHE.pop(next(iter(CACHE)))
        CACHE[key] = (time.monotonic(), result)
        return result
    except (httpx.HTTPError, ValueError):
        if cached:
            return {
                **cached[1],
                "cached": True,
                "notice": cached[1]["notice"]
                + " Live source unavailable; showing saved classifications.",
            }
        raise HTTPException(
            503,
            "The career classification source is temporarily unavailable. You can still enter any career goal and research its learning routes.",
        )


@router.get("/training-routes")
def training_routes(
    goal: str = Query(default="", max_length=200),
    market: str = Query(default="Rwanda", pattern="^(Nigeria|Rwanda|Global)$"),
):
    if not re.search(r"devops|cloud|infrastructure", goal, re.I):
        return []
    if market == "Nigeria":
        return [
            {
                "name": "AltSchool Africa · Cloud Engineering",
                "kind": "Online diploma · cloud and DevOps",
                "location": "Online · accessible from Nigeria",
                "url": "https://engineering.altschoolafrica.com/programs/cloud-engineering",
                "entry_route": "English-language study and entrance assessment; check the provider's current admissions requirements.",
                "cost_note": "Paid diploma; tuition and application charges are listed by the provider. Confirm current fees before applying.",
                "availability_note": "Published training route; confirm intake and applications on the programme page.",
                "accreditation_note": "Provider diploma; recognition and suitability for your target role must be checked separately.",
                "source_checked": "2026-10-14",
            }
        ]
    return [
        {
            "name": "Carnegie Mellon University Africa · DevOps course",
            "kind": "University course",
            "location": "Kigali, Rwanda",
            "url": "https://www.africa.engineering.cmu.edu/academics/courses/04-632.html",
            "entry_route": "Course prerequisites: familiarity with programming languages and operating systems. Contact CMU-Africa about programme eligibility and access.",
            "cost_note": "Fees and standalone access not verified; confirm with the university.",
            "availability_note": "Published course route, not a confirmed open intake.",
            "accreditation_note": "This course page does not establish an accredited standalone qualification.",
            "source_checked": "2026-10-14",
        }
    ]
