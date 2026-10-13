from app.services.learners.seed import seed


def test_preparation_is_goal_scoped_and_reminders_persist(clients):
    a, b, settings, _ = clients
    seed()
    a.post(
        "/api/v1/auth/sign-in",
        json={"email": "ada@wetinnext.local", "password": settings.demo_seed_password},
    )
    result = a.get("/api/v1/me/preparation").json()
    goal = result["goals"][0]
    assert goal["completed_signals"] == 3 and goal["evidence_count"] == 1
    assert goal["next_focus"] == "Quiz" and goal["weeks"][0]["done"]
    assert b.get("/api/v1/me/preparation").json()["goals"] == []
    reminder = {
        "enabled": True,
        "days": [0, 1, 2, 3, 4, 5, 6],
        "time": "00:00",
        "timezone": "Africa/Lagos",
        "focus": "saved evidence",
    }
    saved = a.put("/api/v1/me/reminders", json=reminder)
    assert saved.status_code == 200 and saved.json()["due"]
    a.post("/api/v1/me/reminders/acknowledge")
    assert not a.get("/api/v1/me/reminders").json()["due"]
    assert (
        a.put(
            "/api/v1/me/reminders", json={**reminder, "timezone": "invalid"}
        ).status_code
        == 422
    )
    assert (
        a.put("/api/v1/me/reminders", json={**reminder, "days": [7]}).status_code == 422
    )
    profile = a.get("/api/v1/me").json()["profile"]
    a.put(
        "/api/v1/me/goal",
        json={**profile, "goal": "Learn nursing", "career_track": "auto"},
    )
    assert not a.get("/api/v1/me/reminders").json()["enabled"]
    overview = a.get("/api/v1/me/preparation").json()["goals"]
    assert (
        len(overview) == 2
        and next(g for g in overview if g["active"])["completed_signals"] == 0
    )
    a.post("/api/v1/me/goals/" + goal["id"] + "/activate")
    assert a.get("/api/v1/me/reminders").json()["focus"] == "saved evidence"
    a.delete("/api/v1/me")
    from sqlalchemy.orm import Session
    from sqlalchemy import select
    from app.services.learners.database import engine
    from app.services.learners.models import GoalReminder

    with Session(engine) as session:
        assert not list(session.scalars(select(GoalReminder)))
