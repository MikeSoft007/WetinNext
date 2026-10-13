import json
from datetime import datetime, timedelta, timezone
import httpx
from test_admin_cv import ADMIN, upload
from app.services.catalog import ingestion
from app.services.catalog.store import connect, items, save, now


def job(identifier=101):
    return ingestion.normalize_remotive(
        {
            "id": identifier,
            "title": "Python engineer",
            "company_name": "Example",
            "url": f"https://remotive.com/remote-jobs/software-dev/python-{identifier}",
            "candidate_required_location": "Worldwide",
            "description": "Python SQL REST API",
            "job_type": "full_time",
        }
    )


def test_complete_feed_refresh_preserves_editorial_and_reopens(clients):
    record = job()
    ingestion.persist_records("remotive", [record], True)
    editorial = {
        **record,
        "title": "Reviewed title",
        "deadline_unknown_confirmed": True,
    }
    save("opportunities", editorial, "published")
    ingestion.persist_records(
        "remotive", [{**record, "title": "Upstream changed"}], True
    )
    saved = next(x for x in items("opportunities") if x["id"] == record["id"])
    assert (
        saved["title"] == "Reviewed title"
        and saved["source_snapshot"]["title"] == "Upstream changed"
    )
    assert saved["last_checked_at"] and saved["availability"] == "listed"
    ingestion.persist_records("remotive", [job(102)], True)
    assert (
        next(x for x in items("opportunities") if x["id"] == record["id"])[
            "availability"
        ]
        == "unknown"
    )
    ingestion.persist_records("remotive", [job(102)], True)
    assert (
        next(x for x in items("opportunities") if x["id"] == record["id"])[
            "availability"
        ]
        == "closed"
    )
    a, _, _, _ = clients
    assert not any(
        x["id"] == record["id"] for x in a.get("/api/v1/opportunities").json()
    )
    ingestion.persist_records("remotive", [record], True)
    assert (
        next(x for x in items("opportunities") if x["id"] == record["id"])[
            "availability"
        ]
        == "listed"
    )


def test_partial_feed_never_closes_missing_jobs(clients):
    ingestion.persist_records(
        "jobicy", [{**job(), "id": "jobicy-101", "source": "Jobicy"}]
    )
    ingestion.persist_records("jobicy", [job(102)])
    row = next(x for x in items("opportunities", False) if x["id"] == "jobicy-101")
    assert row["availability"] == "listed"


def test_link_failure_preserves_unknown_and_404_closes(clients, monkeypatch):
    old = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    record = {
        **job(),
        "id": "jobicy-101",
        "source": "Jobicy",
        "url": "https://jobicy.com/jobs/101",
        "last_checked_at": old,
        "availability": "unknown",
    }
    save("opportunities", record, "published")
    original = httpx.Client
    monkeypatch.setattr(
        ingestion.httpx,
        "Client",
        lambda **kwargs: original(
            transport=httpx.MockTransport(lambda request: httpx.Response(503)), **kwargs
        ),
    )
    ingestion.check_jobicy_links()
    current = next(x for x in items("opportunities") if x["id"] == record["id"])
    assert (
        current["availability"] == "unknown"
        and "inconclusive" in current["last_check_result"]
    )
    save("opportunities", {**current, "last_checked_at": old}, "published")
    monkeypatch.setattr(
        ingestion.httpx,
        "Client",
        lambda **kwargs: original(
            transport=httpx.MockTransport(lambda request: httpx.Response(410)), **kwargs
        ),
    )
    ingestion.check_jobicy_links()
    assert (
        next(x for x in items("opportunities") if x["id"] == record["id"])[
            "availability"
        ]
        == "closed"
    )


def test_invalid_remotive_feed_does_not_close(clients, monkeypatch):
    a, _, _, _ = clients
    save("opportunities", job(), "published")
    original = httpx.Client
    monkeypatch.setattr(
        ingestion.httpx,
        "Client",
        lambda **kwargs: original(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(200, json={"jobs": [], "job-count": 0})
            ),
            **kwargs,
        ),
    )
    assert (
        a.post("/api/v1/admin/sources/remotive/sync", headers=ADMIN).status_code == 502
    )
    assert (
        next(x for x in items("opportunities") if x["id"] == job()["id"]).get(
            "availability", "unknown"
        )
        == "unknown"
    )


def test_source_geography_change_is_not_ignored(clients):
    record = job()
    save("opportunities", record, "published")
    changed = ingestion.normalize_remotive(
        {
            "id": 101,
            "title": "Python engineer",
            "url": record["url"],
            "candidate_required_location": "USA",
        }
    )
    ingestion.persist_records("remotive", [changed], True)
    a, _, _, _ = clients
    assert not any(
        x["id"] == record["id"]
        for x in a.get("/api/v1/opportunities?country=Nigeria").json()
    )


def test_journal_persistence_ownership_and_account_delete(clients):
    a, b, _, _ = clients
    path = "/api/v1/preparation/sample-data"
    assert (
        a.put(path, json={"action": "Build a project", "completed": True}).status_code
        == 200
    )
    assert a.get(path).json()["checklist"]["Build a project"]
    assert b.get(path).json()["checklist"] == {}
    assert len(a.get("/api/v1/applications").json()) == 1
    assert b.get("/api/v1/applications").json() == []
    assert (
        a.put(
            "/api/v1/applications/sample-data", json={"status": "applied"}
        ).status_code
        == 422
    )
    assert (
        a.put(
            "/api/v1/applications/sample-data",
            json={"status": "preparing", "notes": "Private next action"},
        ).status_code
        == 200
    )
    assert a.get(path).json()["notes"] == "Private next action"
    assert (
        a.put(path, json={"action": "Build a project", "completed": False}).status_code
        == 200
    )
    assert not a.get(path).json()["checklist"]["Build a project"]
    a.delete("/api/v1/me")
    a.post("/api/v1/demo/session")
    assert a.get("/api/v1/applications").json() == []


def test_application_stages_closed_guard_and_history(clients):
    a, _, _, _ = clients
    record = {**job(), "deadline_unknown_confirmed": True, "availability": "listed"}
    save("opportunities", record, "published")
    path = "/api/v1/applications/" + record["id"]
    for stage in ["interested", "preparing", "applied", "interviewing", "offer"]:
        assert a.put(path, json={"status": stage}).status_code == 200
    a.put(path, json={"status": "offer"})
    entry = a.get("/api/v1/applications").json()[0]
    assert len(entry["history"]) == 5
    save("opportunities", {**record, "availability": "closed"}, "published")
    _, b, _, _ = clients
    assert b.put(path, json={"status": "applied"}).status_code == 422
    assert a.put(path, json={"status": "withdrawn"}).status_code == 200


def test_learner_journey_without_keys(clients):
    a, _, _, _ = clients
    assert (
        a.put(
            "/api/v1/me/profile", json={"name": "  ", "goal": "     ", "hours": 2}
        ).status_code
        == 422
    )
    assert a.post("/api/v1/me/cv-reviews", json=upload()).status_code == 200
    assert (
        a.put(
            "/api/v1/me/profile",
            json={
                "name": " Learner ",
                "goal": "Prepare for a data internship",
                "hours": 2,
                "device": "phone",
                "country": "Nigeria",
            },
        ).status_code
        == 200
    )
    state = a.get("/api/v1/me").json()
    assert state["profile"]["name"] == "Learner" and all(
        w["minutes"] <= 120 for w in state["plan"]["weeks"]
    )
    matches = a.get("/api/v1/recommendations").json()
    assert matches["resources"] and matches["opportunities"]
    opportunity = matches["opportunities"][0]["opportunity"]
    assessment = a.get(f"/api/v1/opportunities/{opportunity['id']}/assessment").json()
    action = assessment["actions"][0]
    a.put(
        f"/api/v1/preparation/{opportunity['id']}",
        json={"action": action, "completed": True},
    )
    a.post(
        "/api/v1/weeks/1/check-in",
        json={"status": "done", "note": "Practised on phone"},
    )
    assert a.get("/api/v1/me").json()["progress"]["1"]["status"] == "done"
    assert a.get(f"/api/v1/preparation/{opportunity['id']}").json()["checklist"][action]
    assert a.get("/api/v1/recommendations").json()["resources"]
    assert any(
        r["id"] == "postgres-tutorial" for r in a.get("/api/v1/resources").json()
    )


def test_deadline_expiry_and_archived_history(clients):
    a, b, _, _ = clients
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()
    record = {**job(), "deadline": yesterday, "availability": "listed"}
    save("opportunities", record, "published")
    detail = a.get("/api/v1/opportunities/" + record["id"]).json()
    assert detail["availability"] == "closed"
    assert not any(
        item["id"] == record["id"] for item in a.get("/api/v1/opportunities").json()
    )
    assert (
        a.put(
            "/api/v1/applications/" + record["id"], json={"status": "applied"}
        ).status_code
        == 422
    )
    a.put(
        "/api/v1/applications/" + record["id"],
        json={"status": "preparing", "notes": "Keep previous research"},
    )
    save("opportunities", record, "archived")
    assert (
        a.get("/api/v1/preparation/" + record["id"]).json()["opportunity"][
            "availability"
        ]
        == "closed"
    )
    assert (
        a.put(
            "/api/v1/applications/" + record["id"], json={"status": "applied"}
        ).status_code
        == 422
    )
    assert (
        a.put(
            "/api/v1/applications/" + record["id"], json={"status": "withdrawn"}
        ).status_code
        == 200
    )
    assert a.get("/api/v1/applications").json()[0]["notes"] == "Keep previous research"
    assert b.get("/api/v1/preparation/" + record["id"]).status_code == 404


def test_remotive_cooldown_and_invalid_full_schema(clients, monkeypatch):
    a, _, _, _ = clients
    original = httpx.Client
    response = {
        "job-count": 1,
        "jobs": [
            {
                "id": 101,
                "title": "Python",
                "url": "https://remotive.com/remote-jobs/dev/python-101",
                "candidate_required_location": "Worldwide",
            }
        ],
    }
    monkeypatch.setattr(
        ingestion.httpx,
        "Client",
        lambda **kwargs: original(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(200, json=response)
            ),
            **kwargs,
        ),
    )
    assert (
        a.post("/api/v1/admin/sources/remotive/sync", headers=ADMIN).status_code == 200
    )
    assert (
        a.post("/api/v1/admin/sources/remotive/sync", headers=ADMIN).status_code == 429
    )
    with connect() as db:
        db.execute(
            "UPDATE source_runs SET attempted_at=? WHERE source='remotive'",
            ((datetime.now(timezone.utc) - timedelta(hours=7)).isoformat(),),
        )
    response["jobs"] = [{"id": 101, "url": "https://untrusted.example/job"}]
    assert (
        a.post("/api/v1/admin/sources/remotive/sync", headers=ADMIN).status_code == 502
    )
    stored = next(
        item for item in items("opportunities", False) if item["id"] == "remotive-101"
    )
    assert stored["availability"] == "listed"
