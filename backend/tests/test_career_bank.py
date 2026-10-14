import asyncio
from app.services.catalog import careers
from test_learning_journey import PROFILE


def test_career_classification_keeps_source_description_and_essential_skills():
    result = careers.normalise(
        {
            "total": 100,
            "_embedded": {
                "results": [
                    {
                        "uri": "occupation-1",
                        "title": "Teacher",
                        "description": {"en": {"literal": "<p>Supports learning.</p>"}},
                        "_links": {
                            "self": {
                                "href": "https://ec.europa.eu/esco/api/resource/occupation?uri=occupation-1"
                            },
                            "hasEssentialSkill": [
                                {"title": "Teach learners"},
                                {"title": "Teach learners"},
                            ],
                        },
                    }
                ]
            },
        }
    )
    assert result["total"] == 100
    assert result["items"][0]["description"] == "Supports learning."
    assert result["items"][0]["skills"] == ["Teach learners"]
    assert "current job listings" in result["notice"]


def test_journey_is_owned_goal_scoped_and_counts_learning_notes_as_evidence(clients):
    client, other, _, _ = clients
    client.put("/api/v1/me/profile", json=PROFILE)
    saved = client.put(
        "/api/v1/weeks/1/work",
        json={
            "checklist": {"learn": True},
            "learning_note": "I can explain a clear audience segment.",
        },
    )
    assert saved.status_code == 200, saved.text
    journal = client.get("/api/v1/me/journey").json()
    assert journal["total"] == 1
    assert journal["items"][0]["status"] == "Evidence recorded"
    assert other.get("/api/v1/me/journey").json()["total"] == 0
    assert any(
        skill["evidence_count"]
        for skill in client.get("/api/v1/me/skills").json()["skills"]
    )
    client.put(
        "/api/v1/me/goal",
        json={**PROFILE, "goal": "Learn nursing", "career_track": "auto"},
    )
    assert client.get("/api/v1/me/journey").json()["total"] == 0


def test_devops_training_reference_is_location_specific_and_not_a_vacancy():
    route = careers.training_routes(goal="Learn DevOps", market="Rwanda")[0]
    assert (
        route["url"]
        == "https://www.africa.engineering.cmu.edu/academics/courses/04-632.html"
    )
    assert "not a confirmed open intake" in route["availability_note"]
    assert careers.training_routes(goal="Learn nursing", market="Rwanda") == []
    assert (
        "accessible from Nigeria"
        in careers.training_routes(goal="Learn DevOps", market="Nigeria")[0]["location"]
    )


def test_journey_includes_completed_quiz_result(clients):
    import json
    from sqlalchemy import select
    from sqlalchemy.orm import Session
    from app.services.learners import database
    from app.services.learners.models import Learner, AssessmentAttempt

    client, _, _, _ = clients
    client.put("/api/v1/me/profile", json=PROFILE)
    with Session(database.engine) as session:
        row = session.scalars(
            select(Learner).where(Learner.profile.contains(PROFILE["name"]))
        ).first()
        session.add(
            AssessmentAttempt(
                id="journal-quiz",
                learner_id=row.id,
                goal=PROFILE["goal"],
                sprint_id=json.loads(row.plan)["id"],
                created_at="2026-10-14T12:00:00+00:00",
                payload=json.dumps({"result": {"correct": 2, "total": 4}}),
            )
        )
        session.commit()
    journal = client.get("/api/v1/me/journey").json()
    assert any(event["kind"] == "practice" for event in journal["items"])
