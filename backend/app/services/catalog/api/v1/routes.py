from app.contracts.schemas import Resource, Opportunity
from fastapi import APIRouter, HTTPException, Query
from app.services.catalog.store import items

router = APIRouter(tags=["Catalogue"])


@router.get("/resources", response_model=list[Resource])
def resources():
    """Read published learning resources with original provider links."""
    return items("resources")


@router.get("/opportunities", response_model=list[Opportunity])
def opportunities(
    country: str | None = None,
    q: str = Query(default="", max_length=100),
    include_closed: bool = False,
):
    return [
        o
        for o in items("opportunities")
        if (include_closed or o.get("availability") != "closed")
        and (not country or o["country"] == country)
        and (
            not q
            or q.casefold()
            in " ".join([o["title"], o["organisation"], *o["skills"]]).casefold()
        )
    ]


@router.get("/opportunities/{oid}", response_model=Opportunity)
def opportunity(oid: str):
    result = next((o for o in items("opportunities") if o["id"] == oid), None)
    if not result:
        raise HTTPException(404, "Opportunity not found.")
    return result


@router.get("/regional-sources")
def regional_sources(country: str | None = None):
    from app.services.catalog.regional import DIRECTORIES

    return [
        {**item, "listing_status": "directory", "verified_on": "2026-10-12"}
        for item in DIRECTORIES
        if not country or item["country"] == country
    ]
