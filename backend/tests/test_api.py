def profile(device="laptop"):
    return dict(
        name="Ada",
        goal="Learn data skills for an internship",
        hours=2,
        device=device,
        learner_type="student",
        country="Nigeria",
        low_data=True,
    )


def test_ownership_and_persistence(clients):
    a, b, _, _ = clients
    assert a.put("/api/v1/me/profile", json=profile()).status_code == 200
    assert a.get("/api/v1/me").json()["profile"]["name"] == "Ada"
    assert b.get("/api/v1/me").json()["plan"] is None
    assert a.put("/api/v1/me/profile", json=profile()).status_code == 409


def test_phone_resource_and_budget(clients):
    a, _, _, _ = clients
    a.put("/api/v1/me/profile", json=profile("phone"))
    plan = a.get("/api/v1/me").json()["plan"]
    assert len(plan["weeks"]) == 4
    assert all(
        w["resource_id"] == "gcf-sheets" and w["minutes"] <= 120 for w in plan["weeks"]
    )


def test_progress_order_retry_and_preservation(clients):
    a, _, _, _ = clients
    a.put("/api/v1/me/profile", json=profile())
    assert (
        a.post("/api/v1/weeks/2/check-in", json={"status": "done"}).status_code == 409
    )
    for _ in range(2):
        assert (
            a.post(
                "/api/v1/weeks/1/check-in",
                json={"status": "done", "note": "Created my tracker"},
            ).status_code
            == 200
        )
    assert len(a.get("/api/v1/me").json()["progress"]) == 1
    assert (
        a.post("/api/v1/weeks/1/check-in", json={"status": "stuck"}).status_code == 409
    )
    result = a.post("/api/v1/weeks/2/check-in", json={"status": "more-time"})
    assert "completed work" in result.json()["advice"]
    assert a.get("/api/v1/me").json()["progress"]["1"]["status"] == "done"


def test_sample_application_and_eligibility(clients):
    a, _, _, _ = clients
    p = profile()
    p["learner_type"] = "self-taught"
    a.put("/api/v1/me/profile", json=p)
    assert (
        "missing"
        in a.get("/api/v1/opportunities/sample-data/assessment").json()["label"]
    )
    assert (
        a.put(
            "/api/v1/applications/sample-data", json={"status": "applied"}
        ).status_code
        == 422
    )
    assert (
        a.put(
            "/api/v1/applications/sample-data", json={"status": "interested"}
        ).status_code
        == 200
    )
    assert (
        a.put("/api/v1/applications/unknown", json={"status": "interested"}).status_code
        == 404
    )


def test_delete_and_auth(clients):
    a, _, settings, _ = clients
    a.put("/api/v1/me/profile", json=profile())
    assert a.delete("/api/v1/me").status_code == 200
    assert a.get("/api/v1/me").status_code == 401
    settings.demo_mode = False
    assert a.post("/api/v1/demo/session").status_code == 404
    assert a.get("/api/v1/me").status_code == 401


def test_bad_inputs_and_origin(clients):
    a, _, _, _ = clients
    p = profile()
    p["hours"] = 0
    assert a.put("/api/v1/me/profile", json=p).status_code == 422
    assert (
        a.post(
            "/api/v1/demo/session", headers={"Origin": "https://unrelated.example"}
        ).status_code
        == 403
    )


def test_ai_failure_preserves_template(clients, monkeypatch):
    _, _, settings, pathways = clients
    settings.openai_api_key = "test-key"
    settings.openai_model = "configured-model"
    import openai

    class Broken:
        def __init__(self, **kwargs):
            raise RuntimeError("Provider unavailable")

    monkeypatch.setattr(openai, "OpenAI", Broken)
    result = pathways.generate(profile())
    assert result["engine"] == "reviewable template"
    assert len(result["weeks"]) == 4
    assert "unavailable" in result["notice"]


def test_market_search_and_openapi(clients):
    a, _, _, _ = clients
    results = a.get("/api/v1/opportunities?country=Rwanda&q=data").json()
    assert len(results) == 1 and results[0]["country"] == "Rwanda"
    assert a.get("/api/v1/opportunities?country=Nigeria&q=notfound").json() == []
    schema = a.get("/api/v1/openapi.json").json()
    assert "/api/v1/me/profile" in schema["paths"]
    assert "Profile" in schema["components"]["schemas"]
    assert "HTTPBearer" in schema["components"]["securitySchemes"]
    assert a.get("/api/health").status_code == 200


def test_history_and_adjustment_preserve_completed_work(clients):
    a, b, _, _ = clients
    a.put("/api/v1/me/profile", json=profile())
    a.post(
        "/api/v1/weeks/1/check-in",
        json={"status": "stuck", "note": "Filtering is tricky"},
    )
    a.post(
        "/api/v1/weeks/1/check-in", json={"status": "done", "note": "I figured it out"}
    )
    a.post(
        "/api/v1/weeks/1/check-in", json={"status": "done", "note": "I figured it out"}
    )
    events = a.get("/api/v1/check-ins").json()
    assert len(events) == 2
    assert b.get("/api/v1/check-ins").json() == []
    before = a.get("/api/v1/me").json()["plan"]["weeks"][0]
    update = a.patch(
        "/api/v1/me/profile", json={"hours": 1, "device": "phone", "low_data": True}
    )
    assert update.status_code == 200
    state = a.get("/api/v1/me").json()
    assert state["plan"]["weeks"][0] == before
    assert state["progress"]["1"]["status"] == "done"
    assert all(
        w["minutes"] <= 60 and w["resource_id"] == "gcf-sheets"
        for w in state["plan"]["weeks"][1:]
    )
    assert state["metrics"]["weekly_streak"] == 1
    assert (
        a.patch(
            "/api/v1/me/profile", json={"hours": 0, "device": "phone", "low_data": True}
        ).status_code
        == 422
    )


def test_matching_evidence_is_explainable(clients):
    a, _, _, _ = clients
    a.put("/api/v1/me/profile", json=profile())
    assessment = a.get("/api/v1/opportunities/sample-data/assessment").json()
    assert any(
        s["requirement"] == "Current university student"
        for s in assessment["supported"]
    )
    assert not any(
        s["requirement"] == "Spreadsheet practice" for s in assessment["supported"]
    )
    a.post("/api/v1/weeks/1/check-in", json={"status": "done"})
    assessment = a.get("/api/v1/opportunities/sample-data/assessment").json()
    assert any(
        s["requirement"] == "Spreadsheet practice" for s in assessment["supported"]
    )
    assert any(g["requirement"] == "SQL" for g in assessment["gaps"])
    assert assessment["sample"] and assessment["deadline"] is None
    assert assessment["honest_guide"]


def test_gateway_service_outage_is_explicit(clients, monkeypatch):
    a, _, _, _ = clients
    from app.gateway.api.v1 import routes
    from fastapi import HTTPException

    async def unavailable(*args, **kwargs):
        raise HTTPException(503, "The catalogue service is temporarily unavailable.")

    monkeypatch.setattr(routes, "service_call", unavailable)
    response = a.get("/api/v1/resources", headers={"X-Request-ID": "test-request"})
    assert response.status_code == 503
    assert response.json()["request_id"] == "test-request"
    assert response.headers["X-Request-ID"] == "test-request"


def test_streak_uses_calendar_weeks():
    from datetime import datetime, timezone
    from app.services.learners.api.v1.routes import weekly_streak

    events = [
        {"updated_at": "2026-10-05T10:00:00+00:00"},
        {"updated_at": "2026-09-29T10:00:00+00:00"},
    ]
    assert weekly_streak(events, datetime(2026, 10, 11, tzinfo=timezone.utc)) == 2
    assert weekly_streak(events, datetime(2026, 10, 26, tzinfo=timezone.utc)) == 0
