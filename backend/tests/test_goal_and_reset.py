from sqlalchemy import select
from sqlalchemy.orm import Session
from app.services.learners.dependencies import learner
from app.services.learners.models import Learner
from app.services.matching.recommendations import recommend
from app.services.matching.intelligence import candidates


def test_parallel_bootstrap_reuses_winning_insert(clients):
    from app.services.learners.database import engine

    # The first lookup saw no row; a concurrent request commits before ours.
    class RacingSession(Session):
        raced = False

        def commit(self):
            if not self.raced:
                self.raced = True
                with Session(engine) as other:
                    other.add(Learner(id="bootstrap-race"))
                    other.commit()
            return super().commit()

    with RacingSession(engine) as session:
        from starlette.requests import Request

        row = learner(
            request=Request({"type": "http", "headers": []}),
            user="bootstrap-race",
            session=session,
        )
        assert row.id == "bootstrap-race"
    with Session(engine) as session:
        assert (
            len(
                list(
                    session.scalars(
                        select(Learner).where(Learner.id == "bootstrap-race")
                    )
                )
            )
            == 1
        )


def test_marketing_goal_excludes_communication_only_jobs():
    profile = {
        "goal": "Digital marketing role",
        "career_track": "marketing",
        "country": "Nigeria",
        "hours": 3,
        "device": "laptop",
    }
    resources = [
        {
            "id": "marketing",
            "title": "Marketing foundations",
            "skills": ["Marketing"],
            "cost": "Free",
            "format": "text",
            "device": "laptop",
        }
    ]
    jobs = [
        {
            "id": "unrelated",
            "title": "Frontend developer",
            "skills": ["JavaScript", "Communication"],
            "country": "Nigeria",
        },
        {
            "id": "relevant",
            "title": "Marketing assistant",
            "skills": ["Marketing", "Communication"],
            "country": "Nigeria",
        },
    ]
    result = recommend({"profile": profile}, [], resources, jobs)
    assert [r["opportunity"]["id"] for r in result["opportunities"]] == ["relevant"]
    assert result["resources"][0]["resource"]["id"] == "marketing"


def test_backend_fallback_prioritizes_goal_gap_and_explains_personal_fit():
    profile = {
        "goal": "Become a backend developer",
        "career_track": "backend",
        "country": "Nigeria",
        "hours": 2,
        "device": "laptop",
    }
    resources = [
        {
            "id": "python",
            "title": "Python tutorial",
            "skills": ["Python"],
            "cost": "Free",
            "format": "Text",
            "device": "laptop",
        },
        {
            "id": "git",
            "title": "Git basics",
            "skills": ["Git"],
            "cost": "Free",
            "format": "Text",
            "device": "laptop",
        },
    ]
    opportunities = [
        {
            "id": "backend-role",
            "title": "Backend internship",
            "country": "Nigeria",
            "skills": ["Python", "Git"],
            "seniority": "Internship",
        }
    ]

    result = recommend(
        {"profile": profile, "progress": {}}, [], resources, opportunities
    )

    assert result["priority_skills"][0] == "Python"
    assert result["resources"][0]["resource"]["id"] == "python"
    match = result["opportunities"][0]
    assert "Become a backend developer" in match["reasons"][0]
    assert "Python" in match["next_action"]
    assert "Not yet mentioned" in " ".join(match["reasons"])


def test_ai_prompt_window_prioritises_goal_over_feed_order():
    unrelated = [
        {
            "id": str(i),
            "title": "Frontend developer",
            "skills": ["HTML"],
            "country": "Nigeria",
        }
        for i in range(45)
    ]
    match = {
        "id": "match",
        "title": "Marketing assistant",
        "skills": ["Marketing"],
        "country": "Nigeria",
    }
    _, jobs = candidates(
        {"goal": "Digital marketing", "country": "Nigeria"}, [], unrelated + [match]
    )
    assert len(jobs) == 40 and jobs[0]["id"] == "match"


def test_reset_reloads_blank_profile_and_can_set_new_goal(clients):
    client, _, _, _ = clients
    profile = {
        "name": "Test learner",
        "goal": "Frontend developer",
        "country": "Nigeria",
        "hours": 3,
        "device": "laptop",
    }
    assert client.put("/api/v1/me/profile", json=profile).status_code == 200
    assert client.delete("/api/v1/me").json() == {"deleted": True}
    assert client.post("/api/v1/demo/session").status_code == 200
    assert client.get("/api/v1/me").json()["plan"] is None
    assert client.get("/api/v1/check-ins").json() == []
    profile["goal"] = "Data analyst"
    assert client.put("/api/v1/me/profile", json=profile).status_code == 200
    assert client.get("/api/v1/recommendations").json()["track"] == "data"


def test_data_centre_is_not_data_analysis(clients):
    from app.core.skills import track_for
    from app.services.learners.pathways import template
    from app.services.catalog.seed import RESOURCES

    profile = {
        "name": "Test",
        "goal": "Become a data center engineer",
        "country": "Nigeria",
        "hours": 3,
        "device": "laptop",
        "career_track": "auto",
    }
    assert track_for(profile) == "infrastructure"
    assert track_for({**profile, "goal": "Data centre engineer"}) == "infrastructure"
    assert track_for({**profile, "goal": "Data analyst"}) == "data"
    assert all(w["resource_id"] == "ubuntu-server" for w in template(profile)["weeks"])
    unrelated = {
        "id": "assistant",
        "title": "Remote assistant",
        "country": "Nigeria",
        "skills": ["Spreadsheets", "Communication"],
    }
    relevant = {
        "id": "infra",
        "title": "Data Center Technician",
        "country": "Nigeria",
        "skills": ["Linux", "Networking"],
    }
    result = recommend({"profile": profile}, [], RESOURCES, [unrelated, relevant])
    assert [o["opportunity"]["id"] for o in result["opportunities"]] == ["infra"]
    assert all(
        r["resource"]["id"] in {"ubuntu-server", "azure-infrastructure"}
        for r in result["resources"]
    )
    assert candidates(profile, RESOURCES, [unrelated])[1] == []
    client, _, _, _ = clients
    assert client.put("/api/v1/me/profile", json=profile).status_code == 200
    assert client.get("/api/v1/recommendations").json()["track"] == "infrastructure"
