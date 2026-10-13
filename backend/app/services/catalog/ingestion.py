"""Allowlisted upstreams, bounded responses, persistent cooldown, draft imports and source freshness."""

import json
import re
import html
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
import httpx
from fastapi import APIRouter, Depends, HTTPException
from typing import Literal
from app.core.admin import require_admin
from app.core.skills import skills_in
from .store import connect, now

router = APIRouter(
    prefix="/admin/sources",
    tags=["Source ingestion"],
    dependencies=[Depends(require_admin)],
)
PROVIDERS = {
    "reliefweb": {
        "name": "ReliefWeb",
        "kind": "opportunities",
        "url": "https://api.reliefweb.int/v2/jobs",
        "docs": "https://apidoc.reliefweb.int/parameters",
        "notice": "Nigeria/Rwanda humanitarian jobs and internships. Approved RELIEFWEB_APPNAME required. Partial feed; absence does not establish closure.",
    },
    "hec": {
        "name": "HEC Rwanda",
        "kind": "opportunities",
        "url": "https://www.hec.gov.rw/updates/scholarships",
        "docs": "https://www.hec.gov.rw/updates/scholarships",
        "notice": "Official scholarship/study-loan notices imported as drafts. PDF eligibility and deadlines need review; old announcements are not asserted open.",
    },
    "jobicy": {
        "name": "Jobicy",
        "kind": "opportunities",
        "url": "https://jobicy.com/api/v2/remote-jobs",
        "docs": "https://github.com/Jobicy/remote-jobs-api",
        "notice": "Worldwide feed, attribution required; geography is not confirmed personal eligibility.",
    },
    "remotive": {
        "name": "Remotive",
        "kind": "opportunities",
        "url": "https://remotive.com/api/remote-jobs",
        "docs": "https://github.com/remotive-com/remote-jobs-api",
        "notice": "Public feed delayed by 24 hours. Attribution and public access required; refreshed at most four times daily.",
    },
    "freecodecamp": {
        "name": "freeCodeCamp",
        "kind": "resources",
        "url": "https://curriculum-db.freecodecamp.org/graphql",
        "docs": "https://curriculum-db.freecodecamp.org/",
        "notice": "Alpha metadata API; course links and device suitability require editorial review.",
    },
}


def init(db):
    db.execute(
        "CREATE TABLE IF NOT EXISTS source_runs (source TEXT PRIMARY KEY, attempted_at TEXT, completed_at TEXT, result TEXT)"
    )


def text(value):
    return html.unescape(re.sub("<[^>]+>", " ", str(value or ""))).strip()


def normalize_job(job, include_restricted=False):
    geo = text(job.get("jobGeo"))
    if not include_restricted and geo.casefold() not in [
        "anywhere",
        "worldwide",
        "global",
        "nigeria",
        "rwanda",
    ]:
        return None
    link = job.get("url", "")
    if (
        urlparse(link).scheme != "https"
        or urlparse(link).hostname != "jobicy.com"
        or not str(job.get("id", "")).isdigit()
    ):
        return None
    description = text(
        job.get("jobDescription")
        or job.get("jobDescriptionHTML")
        or job.get("jobExcerpt")
    )[:7000]
    return {
        "id": f"jobicy-{job['id']}",
        "title": text(job.get("jobTitle"))[:200],
        "organisation": text(job.get("companyName"))[:200],
        "country": (
            geo.title()
            if geo.casefold() in ["nigeria", "rwanda"]
            else (
                "Global"
                if geo.casefold() in ["anywhere", "worldwide", "global"]
                else "Other"
            )
        ),
        "skills": skills_in(description + " " + text(job.get("jobTitle"))),
        "description": text(job.get("jobExcerpt") or description)[:1500],
        "source_text": description,
        "mandatory": f"Source location: {geo}. Level: {text(job.get('jobLevel')) or 'not provided'}. Check employer eligibility and requirements on Jobicy.",
        "type": ", ".join(job.get("jobType") or ["Job"]),
        "sample": False,
        "url": link,
        "deadline": None,
        "source": "Jobicy",
        "source_id": str(job["id"]),
        "fetched_at": now(),
        "geography": geo,
        "seniority": text(job.get("jobLevel")) or None,
        "deadline_unknown_confirmed": False,
    }


def normalize_remotive(job):
    geo = text(job.get("candidate_required_location"))
    link = job.get("url", "")
    if (
        urlparse(link).scheme != "https"
        or urlparse(link).hostname != "remotive.com"
        or not str(job.get("id", "")).isdigit()
    ):
        return None
    description = text(job.get("description"))[:7000]
    return {
        "id": f"remotive-{job['id']}",
        "source_id": str(job["id"]),
        "title": text(job.get("title"))[:200],
        "organisation": text(job.get("company_name"))[:200],
        "country": (
            geo.title()
            if geo.casefold() in ["nigeria", "rwanda"]
            else (
                "Global"
                if geo.casefold() in ["worldwide", "anywhere", "global"]
                else "Other"
            )
        ),
        "skills": skills_in(description + " " + text(job.get("title"))),
        "description": description[:1500],
        "source_text": description,
        "mandatory": f"Source location: {geo}. Confirm employer eligibility on Remotive.",
        "type": text(job.get("job_type") or "Job").replace("_", " "),
        "sample": False,
        "url": link,
        "deadline": None,
        "source": "Remotive",
        "fetched_at": now(),
        "geography": geo,
        "deadline_unknown_confirmed": False,
    }


def persist_records(provider, records, complete_feed=False):
    config = PROVIDERS[provider]
    stamp = now()
    added = updated = skipped = 0
    seen = set()
    with connect() as db:
        for record in records:
            if not record:
                skipped += 1
                continue
            seen.add(record["id"])
            existing = db.execute(
                "SELECT * FROM content WHERE kind=? AND id=?",
                (config["kind"], record["id"]),
            ).fetchone()
            facts = {
                "last_checked_at": stamp,
                "source_seen_at": stamp,
                "last_check_result": "Listed in source feed",
                "availability": "listed",
                "missing_checks": 0,
            }
            if existing:
                payload = json.loads(existing["payload"])
                # Explicit editorial decisions take precedence, including legacy saves.
                manual = (
                    payload.get("publication_mode") == "manual"
                    or db.execute(
                        "SELECT 1 FROM audit WHERE kind=? AND content_id=? AND action LIKE 'save:%' LIMIT 1",
                        (config["kind"], record["id"]),
                    ).fetchone()
                )
                status = existing["status"]
                if not manual and status != "archived":
                    tracked = [
                        "title",
                        "skills",
                        "mandatory",
                        "source_text",
                        "description",
                        "country",
                        "seniority",
                        "deadline",
                        "url",
                        "organisation",
                        "type",
                    ]
                    changes = [
                        key for key in tracked if payload.get(key) != record.get(key)
                    ]
                    payload.update(record)
                    if changes:
                        payload.update(
                            {
                                "source_changed_at": stamp,
                                "source_changed_fields": changes,
                            }
                        )
                        db.execute(
                            "INSERT INTO audit(action,kind,content_id,at) VALUES (?,?,?,?)",
                            (
                                "refresh:requirements",
                                config["kind"],
                                record["id"],
                                stamp,
                            ),
                        )
                payload.update({"source_snapshot": record, **facts})
                if (
                    not manual
                    and status == "published"
                    and payload.get("publication_mode") == "automatic"
                ):
                    from .publication import rejection

                    reason = rejection(config["kind"], payload)
                    if reason:
                        status = "draft"
                        payload["publication_note"] = (
                            "Source changed; publication withdrawn: " + reason
                        )
                        db.execute(
                            "INSERT INTO audit(action,kind,content_id,at) VALUES (?,?,?,?)",
                            (
                                "unpublish:source-change",
                                config["kind"],
                                record["id"],
                                stamp,
                            ),
                        )
                    else:
                        payload["publication_note"] = (
                            "Latest source facts passed automatic checks; confirm personal eligibility on the source"
                        )
                    payload["deadline_unknown_confirmed"] = not bool(
                        payload.get("deadline")
                    )
                if config["kind"] == "opportunities":
                    payload.update(
                        {key: record.get(key) for key in ["country", "geography"]}
                    )
                db.execute(
                    "UPDATE content SET status=?,payload=?,updated_at=? WHERE kind=? AND id=?",
                    (status, json.dumps(payload), stamp, config["kind"], record["id"]),
                )
                updated += 1
            else:
                db.execute(
                    "INSERT INTO content VALUES (?,?,?,?,?)",
                    (
                        config["kind"],
                        record["id"],
                        "draft",
                        json.dumps({**record, **facts}),
                        stamp,
                    ),
                )
                added += 1
        if complete_feed:
            for row in db.execute(
                "SELECT * FROM content WHERE kind='opportunities'"
            ).fetchall():
                payload = json.loads(row["payload"])
                if payload.get("source") != config["name"] or payload["id"] in seen:
                    continue
                misses = payload.get("missing_checks", 0) + 1
                payload.update(
                    {
                        "missing_checks": misses,
                        "last_checked_at": stamp,
                        "availability": "closed" if misses >= 2 else "unknown",
                        "last_check_result": (
                            "Removed from two complete source feeds"
                            if misses >= 2
                            else "Absent from latest complete feed; checking again"
                        ),
                    }
                )
                db.execute(
                    "UPDATE content SET payload=?,updated_at=? WHERE kind='opportunities' AND id=?",
                    (json.dumps(payload), stamp, payload["id"]),
                )
    return added, updated, skipped


def check_jobicy_links():
    """A partial feed cannot establish closure. Check bounded, oldest canonical links."""
    with connect() as db:
        rows = db.execute(
            "SELECT * FROM content WHERE kind='opportunities' AND status != 'archived'"
        ).fetchall()
    records = [json.loads(row["payload"]) for row in rows]
    due = datetime.now(timezone.utc) - timedelta(hours=6)
    records = [
        r
        for r in records
        if r.get("source") == "Jobicy"
        and (
            not r.get("last_checked_at")
            or datetime.fromisoformat(r["last_checked_at"]) < due
        )
    ]
    with httpx.Client(timeout=5, follow_redirects=False) as client:
        for item in sorted(records, key=lambda r: r.get("last_checked_at") or "")[:20]:
            link = urlparse(item.get("url") or "")
            try:
                port = link.port
            except ValueError:
                continue
            if (
                link.scheme != "https"
                or link.hostname != "jobicy.com"
                or link.username
                or port not in [None, 443]
            ):
                continue
            try:
                response = client.head(item["url"])
                closed = response.status_code in [404, 410]
                result = (
                    "Source listing removed (HTTP 404/410)"
                    if closed
                    else (
                        "Page reachable; opening status unconfirmed"
                        if response.status_code == 200
                        else "Source check inconclusive"
                    )
                )
            except httpx.HTTPError:
                closed, result = False, "Unable to verify source"
            with connect() as db:
                row = db.execute(
                    "SELECT payload FROM content WHERE kind='opportunities' AND id=?",
                    (item["id"],),
                ).fetchone()
                if not row:
                    continue
                payload = json.loads(row["payload"])
                payload.update({"last_checked_at": now(), "last_check_result": result})
                if closed:
                    payload["availability"] = "closed"
                elif payload.get("availability") != "closed":
                    payload["availability"] = "unknown"
                db.execute(
                    "UPDATE content SET payload=?,updated_at=? WHERE kind='opportunities' AND id=?",
                    (json.dumps(payload), now(), item["id"]),
                )


def normalize_resource(item):
    slug = item.get("dashedName", "")
    allowed = {
        "responsive-web-design",
        "javascript-algorithms-and-data-structures",
        "front-end-development-libraries",
        "back-end-development-and-apis",
        "scientific-computing-with-python",
        "data-analysis-with-python",
        "relational-databases",
    }
    if slug not in allowed:
        return None
    title = text(item.get("name") or slug.replace("-", " ").title())
    tags = skills_in(title + " " + slug.replace("-", " "))
    if slug == "responsive-web-design":
        tags = ["HTML", "CSS"]
    if slug == "front-end-development-libraries":
        tags = ["React", "JavaScript"]
    if slug == "back-end-development-and-apis":
        tags = ["Node.js", "REST API"]
    if slug == "relational-databases":
        tags = ["SQL"]
    return {
        "id": "fcc-" + slug,
        "title": title,
        "provider": "freeCodeCamp",
        "url": "https://www.freecodecamp.org/learn/" + slug + "/",
        "format": "Interactive curriculum",
        "device": "laptop",
        "cost": "Free",
        "review": "Imported metadata; review course link and lesson suitability before publishing",
        "skills": tags,
        "source": "freeCodeCamp",
        "fetched_at": now(),
    }


@router.get("")
def sources():
    with connect() as db:
        init(db)
        runs = {r["source"]: dict(r) for r in db.execute("SELECT * FROM source_runs")}
    from app.core.config import settings

    return [
        {
            **v,
            "id": k,
            "configured": k != "reliefweb" or bool(settings.reliefweb_appname),
            "last_run": runs.get(k),
        }
        for k, v in PROVIDERS.items()
    ]


@router.post("/{provider}/sync")
def sync(provider: Literal["jobicy", "freecodecamp", "remotive", "reliefweb", "hec"]):
    config = PROVIDERS[provider]
    from app.core.config import settings

    if provider == "reliefweb" and not settings.reliefweb_appname:
        raise HTTPException(
            409,
            "Configure an approved RELIEFWEB_APPNAME before importing regional jobs.",
        )
    with connect() as db:
        init(db)
        db.execute("BEGIN IMMEDIATE")
        previous = db.execute(
            "SELECT * FROM source_runs WHERE source=?", (provider,)
        ).fetchone()
        if previous and datetime.fromisoformat(previous["attempted_at"]) > datetime.now(
            timezone.utc
        ) - timedelta(hours=6 if provider == "remotive" else 1):
            raise HTTPException(
                429,
                "Provider cooldown is active. Reuse existing records; Remotive is checked at most every six hours.",
            )
        db.execute(
            "INSERT INTO source_runs VALUES (?,?,NULL,?) ON CONFLICT(source) DO UPDATE SET attempted_at=excluded.attempted_at,result=excluded.result",
            (provider, now(), "Sync started"),
        )
    try:
        if provider in ["reliefweb", "hec"]:
            from .regional import fetch_records

            normalized = fetch_records(provider)
            complete = False
        else:
            with httpx.Client(timeout=20, follow_redirects=False) as client:
                request = (
                    client.build_request("GET", config["url"], params={"count": 100})
                    if provider == "jobicy"
                    else (
                        client.build_request("GET", config["url"])
                        if provider == "remotive"
                        else client.build_request(
                            "POST",
                            config["url"],
                            json={"query": "{ superblocks { name dashedName } }"},
                        )
                    )
                )
                with client.stream(
                    request.method,
                    str(request.url),
                    headers=request.headers,
                    content=request.content,
                ) as response:
                    response.raise_for_status()
                    raw = bytearray()
                    for chunk in response.iter_bytes():
                        raw.extend(chunk)
                        if len(raw) > (
                            8_000_000 if provider == "remotive" else 4_000_000
                        ):
                            raise ValueError(
                                "Provider response exceeded the allowed size."
                            )
                body = json.loads(raw)
            if body.get("errors") or body.get("success") is False:
                raise ValueError("Provider reported a schema or request error.")
            records = (
                body.get("jobs")
                if provider in ["jobicy", "remotive"]
                else body.get("data", {}).get("superblocks")
            )
            if not isinstance(records, list):
                raise ValueError("Provider response schema changed.")
            normalized = [
                (
                    {
                        "jobicy": lambda job: normalize_job(
                            job, include_restricted=True
                        ),
                        "remotive": normalize_remotive,
                        "freecodecamp": normalize_resource,
                    }[provider]
                )(r)
                for r in records
                if isinstance(r, dict)
            ]
            # Remotive documents a complete active feed; validate its declared count before inferring absence.
            complete = (
                provider == "remotive"
                and bool(records)
                and body.get("job-count") == len(records)
                and len(normalized) == len(records)
                and all(normalized)
            )
            if provider == "remotive" and not complete:
                raise ValueError("Incomplete source feed; existing records preserved")
        added, updated, skipped = persist_records(provider, normalized, complete)
        if provider == "jobicy":
            check_jobicy_links()
        with connect() as db:
            result = f"{added} new drafts; {updated} refreshed; {skipped} skipped"
            db.execute(
                "UPDATE source_runs SET completed_at=?,result=? WHERE source=?",
                (now(), result, provider),
            )
            db.execute(
                "INSERT INTO audit(action,kind,content_id,at) VALUES (?,?,?,?)",
                ("import:draft", config["kind"], provider, now()),
            )
        from .publication import publish_qualified

        published = publish_qualified()
        return {
            "published": published,
            "provider": provider,
            "added": added,
            "skipped": skipped,
            "updated": updated,
            "notice": result
            + f"; {published} passed automatic publication. Editorial decisions are preserved.",
        }
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        with connect() as db:
            db.execute(
                "UPDATE source_runs SET result=? WHERE source=?",
                (
                    "Provider unavailable or response invalid; existing records preserved.",
                    provider,
                ),
            )
        raise HTTPException(
            502,
            "Provider unavailable or response invalid. Existing records were preserved.",
        )
