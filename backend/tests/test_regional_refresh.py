import json
import pytest
import httpx
from app.services.catalog import ingestion, publication
from app.services.catalog.store import connect, items, save
from app.services.catalog.regional import HECNotices, normalize_reliefweb
from app.services.learners.pathways import template
from app.core.skills import track_for
from test_tracking_refresh import job
from test_admin_cv import ADMIN


def test_automatic_refresh_updates_requirements_and_rechecks_even_when_paused(clients):
    a, _, settings, _ = clients
    settings.auto_publish = True
    ingestion.persist_records("remotive", [job()])
    publication.publish_qualified()
    updated = {
        **job(),
        "title": "Junior SQL developer",
        "skills": ["SQL"],
        "mandatory": "SQL assessment required",
        "source_text": "SQL assessment and university qualification required",
    }
    ingestion.persist_records("remotive", [updated])
    live = next(x for x in items("opportunities") if x["id"] == updated["id"])
    assert live["skills"] == ["SQL"] and live["mandatory"] == updated["mandatory"]
    assert live["source_changed_at"] and "skills" in live["source_changed_fields"]
    assert "source_text" in live["source_changed_fields"]
    assert live["source_text"] == updated["source_text"]
    publication.set_enabled(False)
    ingestion.persist_records(
        "remotive", [{**updated, "title": "Senior SQL developer"}]
    )
    assert not any(x["id"] == updated["id"] for x in items("opportunities"))
    draft = next(x for x in items("opportunities", False) if x["id"] == updated["id"])
    assert draft["status"] == "draft" and "Seniority" in draft["publication_note"]
    assert a.get("/api/v1/opportunities/" + updated["id"]).status_code == 404
    publication.set_enabled(True)
    ingestion.persist_records("remotive", [updated])
    assert publication.publish_qualified() == 1
    ingestion.persist_records(
        "remotive", [{**updated, "country": "Other", "geography": "USA"}]
    )
    assert not any(x["id"] == updated["id"] for x in items("opportunities"))
    with connect() as db:
        actions = [r["action"] for r in db.execute("SELECT action FROM audit")]
    assert actions.count("unpublish:source-change") == 2


def test_manual_and_archived_copy_survive_source_changes(clients):
    record = job()
    save("opportunities", {**record, "title": "Editorial title"}, "published")
    save("opportunities", {**job(102), "title": "Archived title"}, "archived")
    ingestion.persist_records(
        "remotive", [{**record, "skills": ["React"]}, {**job(102), "title": "Changed"}]
    )
    manual = next(x for x in items("opportunities") if x["id"] == record["id"])
    assert manual["title"] == "Editorial title" and manual["skills"] == record["skills"]
    assert manual["source_snapshot"]["skills"] == ["React"]
    archived = next(
        x for x in items("opportunities", False) if x["id"] == "remotive-102"
    )
    assert archived["status"] == "archived" and archived["title"] == "Archived title"


def rw_item(country="Rwanda"):
    return {
        "id": "123",
        "fields": {
            "title": "Project coordination intern",
            "country": [{"name": country}],
            "url": "https://reliefweb.int/job/123/project-intern",
            "source": [{"name": "Example NGO"}],
            "body": "Project management communication spreadsheets",
            "experience": [{"name": "0-2 years"}],
            "date": {"closing": "2099-11-10T23:59:59+00:00"},
            "type": [{"name": "Internship"}],
        },
    }


def test_regional_source_boundaries_and_scholarship_drafts(clients):
    a, _, settings, _ = clients
    settings.auto_publish = True
    record = normalize_reliefweb(rw_item())
    assert record["country"] == "Rwanda" and record["deadline"] == "2099-11-10"
    assert normalize_reliefweb(rw_item("United States")) is None
    assert normalize_reliefweb({**rw_item(), "id": "bad"}) is None
    ingestion.persist_records("reliefweb", [record])
    assert publication.publish_qualified() == 1
    assert any(
        x["id"] == record["id"]
        for x in a.get("/api/v1/opportunities?country=Rwanda").json()
    )
    assert not any(
        x["id"] == record["id"]
        for x in a.get("/api/v1/opportunities?country=Nigeria").json()
    )
    parser = HECNotices()
    anchor = '<a title="Scholarship call" href="/fileadmin/user_upload/HEC/Scholarships/call.pdf">Read</a>'
    parser.feed(
        anchor + anchor + '<a title="Bad" href="https://evil.example/call.pdf">Bad</a>'
    )
    assert len(parser.notices) == 1
    ingestion.persist_records("hec", list(parser.notices.values()))
    publication.publish_qualified()
    row = next(x for x in items("opportunities", False) if x["source"] == "HEC Rwanda")
    assert row["status"] == "draft" and "PDF review" in row["publication_note"]
    assert not any(
        x["source"] == "HEC Rwanda" for x in items("opportunities") if x.get("source")
    )
    directories = a.get("/api/v1/regional-sources?country=Nigeria").json()
    assert len(directories) == 2 and all(
        d["country"] == "Nigeria" and d["listing_status"] == "directory"
        for d in directories
    )
    settings.reliefweb_appname = ""
    assert (
        a.post("/api/v1/admin/sources/reliefweb/sync", headers=ADMIN).status_code == 409
    )


@pytest.mark.parametrize(
    "goal,track",
    [
        ("cybersecurity analyst", "cybersecurity"),
        ("digital marketing", "marketing"),
        ("customer support", "support"),
        ("project coordinator", "project"),
        ("apply for scholarship", "scholarship"),
        ("become a nurse", "foundation"),
    ],
)
def test_new_pathways_fit_time_device_and_resources(clients, goal, track):
    a, _, _, _ = clients
    profile = {
        "name": "Test learner",
        "goal": goal,
        "country": "Rwanda",
        "hours": 1,
        "device": "phone",
    }
    assert track_for(profile) == track
    response = a.put("/api/v1/me/profile", json=profile)
    assert response.status_code == 200
    plan = a.get("/api/v1/me").json()["plan"]
    if track == "foundation" and goal == "become a nurse":
        assert plan is None
        assert a.get("/api/v1/me").json()["needs_goal_research"]
        return
    resource_ids = {r["id"] for r in a.get("/api/v1/resources").json()}
    assert len(plan["weeks"]) == 4
    assert all(
        w["minutes"] <= 60 and w["resource_id"] in resource_ids for w in plan["weeks"]
    )
    assert "data project" not in plan["title"].lower()


def test_regional_adapter_fetches_bounded_country_query(clients, monkeypatch):
    from app.services.catalog import regional

    _, _, settings, _ = clients
    settings.reliefweb_appname = "test-approved-app"
    original = httpx.Client
    requests = []

    def upstream(request):
        requests.append(request)
        return httpx.Response(200, json={"data": [rw_item()]})

    monkeypatch.setattr(
        regional.httpx,
        "Client",
        lambda **kw: original(transport=httpx.MockTransport(upstream), **kw),
    )
    assert regional.fetch_records("reliefweb")[0]["country"] == "Rwanda"
    body = json.loads(requests[0].content)
    assert body["filter"]["value"] == ["Nigeria", "Rwanda"] and body["limit"] == 100
