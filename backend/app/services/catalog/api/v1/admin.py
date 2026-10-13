from typing import Literal
from datetime import date
from urllib.parse import urlparse
from pydantic import BaseModel, Field, ValidationError
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.search import rank, paginate
from app.core.admin import require_admin
from app.contracts.schemas import Resource, Opportunity
from app.services.catalog.store import items, save, connect

router = APIRouter(
    prefix="/admin", tags=["Administration"], dependencies=[Depends(require_admin)]
)
from app.contracts.schemas import ContentEdit


@router.get("/content/{kind}")
def listing(kind: Literal["resources", "opportunities"]):
    return items(kind, False)


@router.put("/content/{kind}/{item_id}")
def update(
    kind: Literal["resources", "opportunities"], item_id: str, body: ContentEdit
):
    if (
        not item_id
        or len(item_id) > 80
        or not all(c.isalnum() or c in "-_" for c in item_id)
    ):
        raise HTTPException(
            422, "Use a short ID containing letters, numbers, hyphens, or underscores."
        )
    try:
        item = (
            (Resource if kind == "resources" else Opportunity)
            .model_validate({**body.data, "id": item_id})
            .model_dump()
        )
    except ValidationError:
        raise HTTPException(422, "Complete every required field with valid values.")
    if any(len(str(value)) > 10000 for value in item.values()):
        raise HTTPException(422, "Content fields are too long.")
    if not item["title"].strip():
        raise HTTPException(422, "A title is required.")
    if kind == "opportunities":
        if item["country"] not in ["Nigeria", "Rwanda", "Other", "Global"]:
            raise HTTPException(422, "Select a supported market.")
        if item.get("deadline"):
            try:
                date.fromisoformat(item["deadline"])
            except ValueError:
                raise HTTPException(422, "Use an ISO date for the deadline.")
        if (
            body.status == "published"
            and not item["sample"]
            and (
                not item.get("url")
                or (
                    not item.get("deadline")
                    and not item.get("deadline_unknown_confirmed")
                )
            )
        ):
            raise HTTPException(
                422,
                "Live listings need a source URL and a closing date, or explicit confirmation that the source provides no closing date.",
            )
    link = item.get("url")
    if kind == "resources" and body.status == "published" and not link:
        raise HTTPException(422, "Published resources need a source URL.")
    if link and (
        urlparse(link).scheme != "https"
        or not urlparse(link).hostname
        or urlparse(link).username
    ):
        raise HTTPException(422, "Use an HTTPS source URL without credentials.")
    return save(kind, item, body.status)


@router.get("/audit")
def audit(
    page: int | None = Query(None, ge=1, le=100000),
    page_size: int = Query(10, ge=1, le=50),
    q: str = Query("", max_length=100),
):
    with connect() as db:
        records = [dict(r) for r in db.execute("SELECT * FROM audit ORDER BY id DESC")]
    return (
        paginate(
            rank(records, q, {"action": 2, "kind": 1, "content_id": 3, "at": 1}),
            page,
            page_size,
        )
        if page
        else records[:100]
    )
