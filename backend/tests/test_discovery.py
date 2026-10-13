from app.services.catalog.ingestion import normalize_job, normalize_resource
from app.services.matching.recommendations import recommend
from app.services.learners.pathways import template


def test_location_and_source_validation():
    job = {
        "id": 123,
        "url": "https://jobicy.com/jobs/123",
        "jobTitle": "Python developer",
        "jobGeo": "Anywhere",
        "jobDescriptionHTML": "<p>Python REST API</p>",
    }
    item = normalize_job(job)
    assert item["country"] == "Global" and item["deadline"] is None
    assert "Python" in item["skills"] and item["source"] == "Jobicy"
    assert normalize_job({**job, "jobGeo": "USA"}) is None
    assert normalize_job({**job, "url": "https://evil.example/jobs/123"}) is None
    assert normalize_resource({"dashedName": "unknown"}) is None


def test_career_constraints_and_honest_cv_signals():
    learner = {
        "profile": {
            "goal": "frontend developer",
            "country": "Rwanda",
            "device": "phone",
            "low_data": True,
        }
    }
    resources = [
        {
            "id": "web",
            "title": "Web",
            "skills": ["HTML", "CSS"],
            "device": "laptop",
            "format": "text",
        }
    ]
    jobs = [
        {"id": "a", "country": "Nigeria", "skills": ["HTML"]},
        {
            "id": "b",
            "country": "Global",
            "skills": ["HTML", "CSS"],
            "seniority": "Senior",
        },
    ]
    result = recommend(learner, [{"skills": ["HTML"]}], resources, jobs)
    assert result["track"] == "frontend"
    assert len(result["opportunities"]) == 1
    assert result["opportunities"][0]["mentioned_skills"] == ["HTML"]
    assert result["opportunities"][0]["evidence_to_clarify"] == ["CSS"]
    assert "computer" in result["resources"][0]["reasons"][1]
    assert any("seniority" in x for x in result["opportunities"][0]["reasons"])


def test_pathways_follow_career_goal():
    profile = {"goal": "backend developer", "device": "laptop", "hours": 2}
    plan = template(profile)
    assert plan["weeks"][0]["resource_id"] == "python-tutorial"
    assert all(w["minutes"] <= 120 for w in plan["weeks"])
    phone = template({**profile, "goal": "frontend developer", "device": "phone"})
    assert phone["weeks"][0]["resource_id"] == "mdn-web"
    assert "implementation pending" in phone["weeks"][0]["success"]


def test_ingestion_draft_cooldown_and_publication(clients, monkeypatch):
    import httpx
    from app.services.catalog import ingestion
    from test_admin_cv import ADMIN

    a, b, _, _ = clients
    assert a.post("/api/v1/admin/sources/jobicy/sync").status_code == 403
    original = httpx.Client
    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200,
            json={
                "jobs": [
                    {
                        "id": 123,
                        "url": "https://jobicy.com/jobs/123",
                        "jobGeo": "Anywhere",
                        "jobTitle": "Python developer",
                        "jobType": ["Full-time"],
                    }
                ]
            },
        )
    )
    monkeypatch.setattr(
        ingestion.httpx, "Client", lambda **kw: original(transport=transport, **kw)
    )
    response = a.post("/api/v1/admin/sources/jobicy/sync", headers=ADMIN)
    assert response.status_code == 200, response.text
    assert response.json()["added"] == 1
    assert not any(
        o["id"] == "jobicy-123" for o in b.get("/api/v1/opportunities").json()
    )
    assert a.post("/api/v1/admin/sources/jobicy/sync", headers=ADMIN).status_code == 429
    draft = next(
        o
        for o in a.get("/api/v1/admin/content/opportunities", headers=ADMIN).json()
        if o["id"] == "jobicy-123"
    )
    draft["deadline_unknown_confirmed"] = True
    assert (
        a.put(
            "/api/v1/admin/content/opportunities/jobicy-123",
            headers=ADMIN,
            json={"status": "published", "data": draft},
        ).status_code
        == 200
    )
    assert any(
        o["id"] == "jobicy-123"
        for o in b.get("/api/v1/opportunities?country=Global").json()
    )
    assert b.get("/api/v1/recommendations").status_code == 200


def test_device_adjustment_preserves_coding_track(clients):
    a, _, _, _ = clients
    response = a.put(
        "/api/v1/me/profile",
        json={
            "name": "Test",
            "goal": "frontend developer",
            "career_track": "frontend",
            "hours": 3,
            "device": "laptop",
        },
    )
    assert response.status_code == 200
    a.post("/api/v1/weeks/1/check-in", json={"status": "done", "note": "built a page"})
    before = a.get("/api/v1/me").json()["plan"]["weeks"][0]
    assert (
        a.patch(
            "/api/v1/me/profile", json={"hours": 1, "device": "phone", "low_data": True}
        ).status_code
        == 200
    )
    weeks = a.get("/api/v1/me").json()["plan"]["weeks"]
    assert weeks[0] == before
    assert all(w["resource_id"] == "mdn-web" for w in weeks)
    assert "Phone preparation" in weeks[1]["task"]
    assert weeks[1]["minutes"] <= 60
    a.patch(
        "/api/v1/me/profile", json={"hours": 2, "device": "laptop", "low_data": True}
    )
    assert (
        "Phone preparation"
        not in a.get("/api/v1/me").json()["plan"]["weeks"][1]["task"]
    )


def test_phone_compatible_resource_label():
    result = recommend(
        {"profile": {"goal": "data", "device": "phone"}},
        [],
        [
            {
                "id": "gcf-sheets",
                "title": "Sheets",
                "device": "phone or laptop",
                "format": "text",
            }
        ],
        [],
    )
    assert not any("computer" in reason for reason in result["resources"][0]["reasons"])


def test_recorded_practice_informs_matches_without_claiming_mastery():
    learner = {
        "profile": {"goal": "frontend developer", "country": "Rwanda"},
        "progress": {"1": {"status": "done"}},
        "plan": {"weeks": [{"week": 1, "resource_id": "web"}]},
    }
    result = recommend(
        learner,
        [],
        [
            {
                "id": "web",
                "title": "HTML",
                "skills": ["HTML"],
                "device": "laptop",
                "format": "text",
            }
        ],
        [{"id": "job", "country": "Global", "skills": ["HTML"]}],
    )
    match = result["opportunities"][0]
    assert any("Related practice recorded" in reason for reason in match["reasons"])
    assert match["mentioned_skills"] == []
    assert match["evidence_to_clarify"] == ["HTML"]


def test_automatic_refresh_controls_and_due_sources(clients, monkeypatch):
    from app.services.catalog import automatic
    from app.services.catalog.store import connect, now
    from app.services.catalog.ingestion import init
    from test_admin_cv import ADMIN

    a, _, _, _ = clients
    assert not a.get("/api/v1/admin/source-settings", headers=ADMIN).json()["enabled"]
    calls = []
    monkeypatch.setattr(automatic, "sync", lambda provider: calls.append(provider))
    automatic.run_due()
    assert not calls
    assert (
        a.put(
            "/api/v1/admin/source-settings", headers=ADMIN, json={"enabled": True}
        ).status_code
        == 200
    )
    with connect() as db:
        init(db)
        db.execute(
            "INSERT INTO source_runs VALUES (?,?,?,?)",
            ("jobicy", now(), now(), "recent"),
        )
    automatic.run_due()
    assert calls == ["hec", "remotive", "freecodecamp"]
    a.post("/api/v1/auth/admin-demo")
    assert (
        a.put("/api/v1/admin/source-settings", json={"enabled": False}).status_code
        == 403
    )
