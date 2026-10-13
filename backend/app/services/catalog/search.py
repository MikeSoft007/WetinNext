"""Optional Elasticsearch catalogue index. SQLite remains the source of truth.

Only catalogue text is indexed, never learner profiles, CVs, check-ins or notes.
Every result is intersected with current canonical visibility/market filters.
"""

import hashlib
import json
import logging
import threading
import time
import httpx
from fastapi import APIRouter, Depends, Query
from typing import Literal
from app.core.admin import require_admin
from app.core.config import settings
from app.core.search import rank, paginate, tokens
from .store import items

router = APIRouter(tags=["Search"])
FIELDS = {
    "title": 4,
    "skills": 3,
    "organisation": 2,
    "provider": 2,
    "description": 1,
    "review": 1,
    "mandatory": 1,
    "id": 2,
    "country": 1,
    "type": 1,
    "status": 1,
}
_LOCK = threading.Lock()
_FINGERPRINT = ""
_RETRY_AFTER = 0


def elastic_rank(records, query):
    global _FINGERPRINT, _RETRY_AFTER
    if (
        not settings.elasticsearch_url
        or not query.strip()
        or time.monotonic() < _RETRY_AFTER
        or len(records) > 10000
    ):
        return None
    try:
        with _LOCK:
            all_records = [
                {**r, "_key": kind + ":" + r["id"]}
                for kind in ["opportunities", "resources"]
                for r in items(kind, False)
            ]
            if len(all_records) > 10000:
                return None
            documents = [
                {"_key": r["_key"], **{k: r.get(k, "") for k in FIELDS}}
                for r in all_records
            ]
            fingerprint = hashlib.sha256(
                json.dumps(
                    [
                        settings.elasticsearch_url,
                        settings.elasticsearch_index,
                        documents,
                    ],
                    sort_keys=True,
                ).encode()
            ).hexdigest()
            headers = (
                {"Authorization": "ApiKey " + settings.elasticsearch_api_key}
                if settings.elasticsearch_api_key
                else {}
            )
            with httpx.Client(
                base_url=settings.elasticsearch_url.rstrip("/") + "/",
                headers=headers,
                timeout=3,
                follow_redirects=False,
            ) as client:
                if fingerprint != _FINGERPRINT:
                    lines = []
                    for doc in documents:
                        doc = dict(doc)
                        key = doc.pop("_key")
                        lines += [
                            json.dumps(
                                {
                                    "index": {
                                        "_index": settings.elasticsearch_index,
                                        "_id": key,
                                    }
                                }
                            ),
                            json.dumps(doc),
                        ]
                    result = client.post(
                        "_bulk?refresh=wait_for",
                        content="\n".join(lines) + "\n",
                        headers={"Content-Type": "application/x-ndjson"},
                    )
                    result.raise_for_status()
                    if result.json().get("errors"):
                        raise ValueError("Catalogue indexing failed")
                    _FINGERPRINT = fingerprint
                # Canonical candidates enforce access even if an archived/deleted document remains indexed.
                keys = [r["_key"] for r in records]
                if not keys:
                    return []
                fields = [f"{field}^{weight}" for field, weight in FIELDS.items()]
                clauses = [
                    {
                        "bool": {
                            "should": [
                                {
                                    "multi_match": {
                                        "query": term,
                                        "fields": fields,
                                        "fuzziness": "AUTO",
                                    }
                                },
                                {
                                    "multi_match": {
                                        "query": term,
                                        "fields": fields,
                                        "type": "bool_prefix",
                                    }
                                },
                            ],
                            "minimum_should_match": 1,
                        }
                    }
                    for term in tokens(query)[:12]
                ]
                result = client.post(
                    settings.elasticsearch_index + "/_search",
                    json={
                        "size": len(keys),
                        "_source": False,
                        "sort": [{"_score": "desc"}, {"id.keyword": "asc"}],
                        "query": {
                            "bool": {
                                "filter": [{"ids": {"values": keys}}],
                                "must": clauses,
                            }
                        },
                    },
                )
                result.raise_for_status()
                body = result.json()
                if body.get("timed_out") or body.get("_shards", {}).get("failed", 0):
                    raise ValueError("Incomplete search response")
                by_key = {r["_key"]: r for r in records}
                return [
                    by_key[h["_id"]] for h in body["hits"]["hits"] if h["_id"] in by_key
                ]
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        _RETRY_AFTER = time.monotonic() + 30
        logging.getLogger(__name__).warning(
            "Catalogue search unavailable; using local search"
        )
        return None


def search_catalog(
    kind,
    q,
    country,
    status,
    page,
    page_size,
    admin=False,
    live_only=False,
    low_data_only=False,
):
    records = [{**r, "_key": kind + ":" + r["id"]} for r in items(kind, not admin)]
    records = [
        r
        for r in records
        if (not country or kind == "resources" or r.get("country") == country)
        and (not admin or status == "all" or r.get("status") == status)
        and (admin or r.get("availability") != "closed")
        and (not live_only or not r.get("sample"))
    ]
    if low_data_only and kind == "resources":
        records = [r for r in records if r.get("low_data_suitable")]
    ranked = elastic_rank(records, q)
    engine = "elasticsearch" if ranked is not None else "local"
    if ranked is None:
        ranked = rank(records, q, FIELDS)
    return paginate(
        [{k: v for k, v in r.items() if k != "_key"} for r in ranked],
        page,
        page_size,
        engine,
    )


@router.get("/search")
def public_search(
    kind: Literal["resources", "opportunities"] = "opportunities",
    q: str = Query("", max_length=100),
    country: Literal["Nigeria", "Rwanda", "Global"] | None = None,
    page: int = Query(1, ge=1, le=100000),
    page_size: int = Query(6, ge=1, le=50),
    live_only: bool = False,
    low_data_only: bool = False,
):
    return search_catalog(
        kind,
        q,
        country,
        "published",
        page,
        page_size,
        live_only=live_only,
        low_data_only=low_data_only,
    )


@router.get("/admin/search", dependencies=[Depends(require_admin)])
def admin_search(
    kind: Literal["resources", "opportunities"] = "opportunities",
    q: str = Query("", max_length=100),
    country: Literal["Nigeria", "Rwanda", "Global"] | None = None,
    status: Literal["all", "published", "draft", "archived"] = "all",
    page: int = Query(1, ge=1, le=100000),
    page_size: int = Query(10, ge=1, le=50),
):
    return search_catalog(kind, q, country, status, page, page_size, admin=True)
