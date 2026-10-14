"""The actual gateway flow, including model outage and persistent evidence ownership."""

import base64
from app.services.matching import intelligence

PROFILE = {
    "name": "Journey learner",
    "goal": "Prepare for a digital marketing role",
    "career_track": "marketing",
    "country": "Nigeria",
    "hours": 3,
    "device": "laptop",
    "background": "Research and communication",
    "low_data": True,
}


def test_profile_sprint_work_discovery_cv_application_and_erasure(clients):
    client, other, _, _ = clients
    assert client.put("/api/v1/me/profile", json=PROFILE).status_code == 200
    state = client.get("/api/v1/me").json()
    assert state["plan"]["id"]
    assert all(w["resource_id"] == "openstax-marketing" for w in state["plan"]["weeks"])
    work = client.get("/api/v1/weeks/1/work").json()
    assert [action["id"] for action in work["actions"]] == ["learn", "build", "verify"]
    assert work["resource"]["low_data_suitable"]
    body = {
        "checklist": {"learn": True, "build": True, "verify": True},
        "evidence_url": "https://example.com/my-practice",
        "reflection": "Created a fictional business campaign brief and checked my assumptions.",
        "learning_note": "I learned to define one audience before choosing a message.",
        "practice_example": "I wrote a campaign brief for a fictional local shop.",
        "open_question": "How would I compare two audience segments?",
    }
    saved = client.put("/api/v1/weeks/1/work", json=body)
    assert saved.status_code == 200, saved.text
    restored = client.get("/api/v1/weeks/1/work").json()
    assert restored["reflection"] == body["reflection"]
    assert restored["learning_note"] == body["learning_note"]
    assert restored["practice_example"] == body["practice_example"]
    assert restored["open_question"] == body["open_question"]
    assert client.get("/api/v1/me/portfolio").json()[0]["practice_example"] == body["practice_example"]
    assert other.get("/api/v1/me/portfolio").json() == []
    assert other.get("/api/v1/weeks/1/work").status_code == 404
    # Evidence persists across availability adjustments, which do not create another sprint.
    assert (
        client.patch(
            "/api/v1/me/profile", json={"hours": 2, "device": "phone", "low_data": True}
        ).status_code
        == 200
    )
    assert client.get("/api/v1/weeks/1/work").json()["checklist"]["build"]
    for week in range(1, 5):
        response = client.post(
            f"/api/v1/weeks/{week}/check-in",
            json={"status": "done", "note": "Practised with fictional examples."},
        )
        assert response.status_code == 200, response.text
    assert len(client.get("/api/v1/check-ins").json()) == 4
    discovery = client.get("/api/v1/recommendations?country=Nigeria").json()
    assert discovery["engine"] == "rule-based fallback"
    assert discovery["resources"] and all(
        r["resource"]["low_data_suitable"] for r in discovery["resources"]
    )
    cv = "Education University student. Skills Communication. Projects A sample campaign brief. Experience Helped 100 students. Research using credible sources."
    reviewed = client.post(
        "/api/v1/me/cv-reviews",
        json={
            "filename": "journey.txt",
            "content_base64": base64.b64encode(cv.encode()).decode(),
            "goal": "Digital marketing role",
        },
    ).json()
    assert reviewed["suggested_resources"] and any(
        "Marketing" in r["skills"] for r in reviewed["suggested_resources"]
    )
    context = intelligence.evidence_context(
        client.get("/api/v1/me").json(), [reviewed], []
    )
    assert body["evidence_url"] not in str(context) and body["reflection"] not in str(
        context
    )
    # Existing preparation/application path remains connected and ownership-scoped.
    assert (
        client.put(
            "/api/v1/applications/sample-data", json={"status": "preparing"}
        ).status_code
        == 200
    )
    assert any(
        r["opportunity_id"] == "sample-data"
        for r in client.get("/api/v1/applications").json()
    )
    assert other.get("/api/v1/applications").json() == []
    assert client.delete("/api/v1/me").status_code == 200
    client.post("/api/v1/demo/session")
    assert client.get("/api/v1/me/portfolio").json() == []


def test_work_rejects_unknown_actions_bad_links_and_invalid_weeks(clients):
    client, _, _, _ = clients
    client.put("/api/v1/me/profile", json=PROFILE)
    assert client.get("/api/v1/weeks/5/work").status_code == 404
    assert (
        client.put(
            "/api/v1/weeks/1/work", json={"checklist": {"fake": True}}
        ).status_code
        == 422
    )
    for url in [
        "javascript:alert(1)",
        "https://user:password@example.com/work",
        "http://example.com/work",
    ]:
        assert (
            client.put("/api/v1/weeks/1/work", json={"evidence_url": url}).status_code
            == 422
        )
    assert client.get("/api/v1/me/portfolio").json() == []


def test_readiness_counts_new_learning_evidence_fields(clients):
    client, _, _, _ = clients
    assert client.put("/api/v1/me/profile", json=PROFILE).status_code == 200
    note_only = client.put(
        "/api/v1/weeks/1/work",
        json={"learning_note": "I learned to group campaign results by audience."},
    )
    example_only = client.put(
        "/api/v1/weeks/2/work",
        json={"practice_example": "I made a sample chart from fictional results."},
    )
    assert note_only.status_code == 200, note_only.text
    assert example_only.status_code == 200, example_only.text
    assert client.get("/api/v1/me/readiness").json()["evidence_count"] == 2


def test_resource_format_filter_is_honest_and_functional(clients):
    client, _, _, _ = clients
    resources = client.get("/api/v1/resources").json()
    assert all(
        r["learning_outcomes"] and r["sample_exercise"] and r["data_note"]
        for r in resources
    )
    video = next(r for r in resources if r["id"] == "hubspot-marketing")
    assert video["data_usage"] == "video_heavy" and not video["low_data_suitable"]
    filtered = client.get(
        "/api/v1/search?kind=resources&low_data_only=true&page_size=50"
    ).json()
    assert filtered["items"] and all(r["low_data_suitable"] for r in filtered["items"])
    assert not any(r["id"] == "hubspot-marketing" for r in filtered["items"])


def test_creation_uses_published_alternative_when_template_source_is_archived(clients):
    from test_admin_cv import ADMIN

    client, _, _, _ = clients
    resource = next(
        r
        for r in client.get("/api/v1/resources").json()
        if r["id"] == "openstax-marketing"
    )
    assert (
        client.put(
            "/api/v1/admin/content/resources/openstax-marketing",
            headers=ADMIN,
            json={"status": "archived", "data": resource},
        ).status_code
        == 200
    )
    assert client.put("/api/v1/me/profile", json=PROFILE).status_code == 200
    available = {r["id"] for r in client.get("/api/v1/resources").json()}
    assert all(
        w["resource_id"] in available
        for w in client.get("/api/v1/me").json()["plan"]["weeks"]
    )


def test_empty_catalogue_does_not_save_a_partial_sprint(clients, monkeypatch):
    client, _, _, pathways = clients
    before = client.get("/api/v1/me").json()
    monkeypatch.setattr(pathways, "get_catalog_resources", lambda: [])
    result = client.put("/api/v1/me/profile", json=PROFILE)
    assert result.status_code == 503
    after = client.get("/api/v1/me").json()
    assert after["profile"] == before["profile"] and after["plan"] == before["plan"]
