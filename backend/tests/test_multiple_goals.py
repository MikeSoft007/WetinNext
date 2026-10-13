from app.services.learners import database
from app.services.learners.models import PlanRevision, GoalWorkspace
from sqlalchemy.orm import Session
from sqlalchemy import select
import hashlib, json

FRONT = {
    "name": "Test",
    "goal": "Frontend developer",
    "career_track": "frontend",
    "country": "Rwanda",
    "hours": 3,
    "device": "laptop",
}
NURSE = {**FRONT, "goal": "Learn nursing", "career_track": "auto"}


def test_switch_goals_restores_plan_progress_evidence_and_scopes_history(clients):
    client, other, _, _ = clients
    assert client.put("/api/v1/me/profile", json=FRONT).status_code == 200
    first = client.get("/api/v1/me").json()
    first_id = first["goal_id"]
    plan_id = first["plan"]["id"]
    client.put("/api/v1/weeks/1/work", json={"reflection": "Built a sample HTML page."})
    client.post(
        "/api/v1/weeks/1/check-in", json={"status": "done", "note": "Saved my page."}
    )
    assert client.put("/api/v1/me/goal", json=NURSE).status_code == 200
    assert client.get("/api/v1/check-ins").json() == []
    assert client.get("/api/v1/me/portfolio").json() == []
    goals = client.get("/api/v1/me/goals").json()
    assert len(goals) == 2
    assert next(g for g in goals if g["id"] == first_id)["completed_weeks"] == 1
    assert other.post(f"/api/v1/me/goals/{first_id}/activate").status_code == 404
    assert client.post(f"/api/v1/me/goals/{first_id}/activate").status_code == 200
    restored = client.get("/api/v1/me").json()
    assert (
        restored["plan"]["id"] == plan_id
        and restored["progress"]["1"]["status"] == "done"
    )
    assert (
        client.get("/api/v1/me/portfolio").json()[0]["reflection"]
        == "Built a sample HTML page."
    )
    assert len(client.get("/api/v1/check-ins").json()) == 1
    assert client.put("/api/v1/me/goal", json=NURSE).json()["restored"]
    assert len(client.get("/api/v1/me/goals").json()) == 2
    assert client.get("/api/v1/me/skills").json()["skills"] == []
    client.post(f"/api/v1/me/goals/{first_id}/activate")
    skills = client.get("/api/v1/me/skills").json()["skills"]
    assert any(
        s["name"] == "HTML" and 1 in s["practised_weeks"] and s["evidence_count"] == 1
        for s in skills
    )
    assert client.delete("/api/v1/me").status_code == 200
    owner = hashlib.sha256(
        client.cookies.get("wetinnext_demo", "").encode()
    ).hexdigest()
    with Session(database.engine) as session:
        assert not list(session.scalars(select(GoalWorkspace)))


def test_legacy_goal_recovered_from_revision_profile(clients):
    client, _, _, _ = clients
    client.put("/api/v1/me/profile", json=NURSE)
    owner = hashlib.sha256(client.cookies.get("wetinnext_demo").encode()).hexdigest()
    with Session(database.engine) as session:
        session.add(
            PlanRevision(
                id="old",
                learner_id=owner,
                payload=json.dumps(
                    {"profile": FRONT, "plan": None, "progress": {}, "at": "2026-10-01"}
                ),
            )
        )
        session.commit()
    goals = client.get("/api/v1/me/goals").json()
    assert {g["goal"] for g in goals} == {"Frontend developer", "Learn nursing"}


def test_goal_changes_preserve_account_name(clients):
    client, _, _, _ = clients
    client.put("/api/v1/me/profile", json=FRONT)
    client.put("/api/v1/me/goal", json={**NURSE, "name": "A different goal name"})
    assert client.get("/api/v1/me").json()["profile"]["name"] == "Test"
    first = next(
        g for g in client.get("/api/v1/me/goals").json() if g["goal"] == FRONT["goal"]
    )
    client.post(f"/api/v1/me/goals/{first['id']}/activate")
    assert client.get("/api/v1/me").json()["profile"]["name"] == "Test"


def test_signed_in_account_survives_new_browser_and_is_separate_from_demo(
    clients, monkeypatch
):
    from app.core import security

    client, other, _, _ = clients
    monkeypatch.setattr(
        security,
        "verified_claims",
        lambda request: {
            "sub": "stable-account-123",
            "user_metadata": {"full_name": "Account learner"},
        },
    )
    auth = {"Authorization": "Bearer test-signed-session"}
    assert (
        client.get("/api/v1/me", headers=auth).json()["profile"]["name"]
        == "Account learner"
    )
    client.put("/api/v1/me/profile", headers=auth, json=FRONT)
    client.put("/api/v1/me/goal", headers=auth, json=NURSE)
    client.post("/api/v1/auth/sign-out")
    restored = other.get("/api/v1/me", headers=auth).json()
    assert restored["profile"]["name"] == "Account learner"
    assert restored["profile"]["goal"] == NURSE["goal"]
    assert len(other.get("/api/v1/me/goals", headers=auth).json()) == 2
    assert other.get("/api/v1/me").json()["profile"] == {}
    assert (
        other.get("/api/v1/auth/session", headers=auth).json()["id"]
        == "stable-account-123"
    )
