import json
from sqlalchemy.orm import Session
from sqlalchemy import select
from test_web_research import guide, PROFILE, URL
from app.services.matching import research as r
from app.services.learners import learning_picks
from app.services.learners.models import LearningPick
from app.services.learners import database


def test_learning_choices_follow_goal_market_owner_and_erasure(clients, monkeypatch):
    client, other, settings, _ = clients
    from app.services.matching.api.v1 import routes

    monkeypatch.setattr(r, "service_call", routes.service_call)
    monkeypatch.setattr(learning_picks, "service_call", routes.service_call)
    settings.openai_api_key = "mock"
    settings.openai_model = "mock"
    client.put("/api/v1/me/profile", json=PROFILE)

    async def build(profile, city, market, stage):
        stage.sources({URL: {"url": URL, "title": "Anatomy textbook"}})
        result = r.validate_guide(guide(), {r.canonical_url(URL): {}}, profile)
        return {
            **result,
            "goal": profile["goal"],
            "market": market,
            "location": "Kigali, Rwanda",
            "sources": [{"url": URL, "title": "Anatomy textbook"}],
        }

    monkeypatch.setattr(r, "build_guide", build)
    jid = client.post("/api/v1/research", json={"market": "Rwanda"}).json()["id"]
    job = client.get("/api/v1/research/" + jid).json()
    assert job["source_count"] == 1 and job["source_preview"][0]["url"] == URL
    assert (
        other.post(
            "/api/v1/me/learning-picks",
            json={"research_id": jid, "resource_id": "anatomy"},
        ).status_code
        == 404
    )
    payload = {"research_id": jid, "resource_id": "anatomy"}
    pick = client.post("/api/v1/me/learning-picks", json=payload).json()
    assert pick["status"] == "saved" and pick["url"] == URL
    assert (
        client.post("/api/v1/me/learning-picks", json=payload).json()["id"]
        == pick["id"]
    )
    assert (
        other.patch(
            "/api/v1/me/learning-picks/" + pick["id"], json={"status": "read"}
        ).status_code
        == 404
    )
    client.patch("/api/v1/me/learning-picks/" + pick["id"], json={"status": "reading"})
    assert (
        client.get("/api/v1/me/learning-picks?market=Rwanda").json()[0]["status"]
        == "reading"
    )
    assert client.get("/api/v1/me/learning-picks?market=Nigeria").json() == []
    client.put(
        "/api/v1/me/goal",
        json={**PROFILE, "goal": "Learn pottery", "career_track": "auto"},
    )
    assert client.get("/api/v1/me/learning-picks?market=Rwanda").json() == []
    assert (
        client.patch(
            "/api/v1/me/learning-picks/" + pick["id"], json={"status": "read"}
        ).status_code
        == 404
    )
    client.delete("/api/v1/me")
    with Session(database.engine) as session:
        assert not list(session.scalars(select(LearningPick)))
