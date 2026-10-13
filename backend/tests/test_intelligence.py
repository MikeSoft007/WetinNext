"""Grounding and integration checks using deterministic model doubles, never live keys."""

import asyncio
import base64
from types import SimpleNamespace
import pytest
from app.services.matching import intelligence as engine

ADMIN = {"X-Admin-Key": "test-admin-key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
PROFILE = {
    "name": "Private Name",
    "goal": "Become a backend developer",
    "country": "Rwanda",
    "hours": 2,
    "device": "laptop",
    "background": "Basic Python",
    "career_track": "backend",
}


@pytest.fixture(autouse=True)
def empty_guidance_cache(monkeypatch):
    engine._COOLDOWN.clear()
    engine._COOLDOWN_REASON.clear()
    engine._FAILURES.clear()
    engine._FAILURE_REASONS.clear()
    engine._CACHE.clear()
    engine._LOCKS.clear()
    monkeypatch.setattr(engine, "_LIMIT", asyncio.Semaphore(2))
    yield
    engine._COOLDOWN.clear()
    engine._COOLDOWN_REASON.clear()
    engine._FAILURES.clear()
    engine._FAILURE_REASONS.clear()
    engine._CACHE.clear()
    engine._LOCKS.clear()


def setup_learner(clients):
    a, b, settings, _ = clients
    assert a.put("/api/v1/me/profile", json=PROFILE).status_code == 200
    job = {
        "title": "Backend intern",
        "organisation": "Example provider",
        "type": "Internship",
        "country": "Rwanda",
        "skills": ["Python", "SQL"],
        "description": "Build simple Python tools and queries",
        "mandatory": "Confirm eligibility",
        "sample": False,
        "url": "https://example.com/backend",
        "deadline": "2099-12-31",
    }
    assert (
        a.put(
            "/api/v1/admin/content/opportunities/backend-intern",
            headers=ADMIN,
            json={"status": "published", "data": job},
        ).status_code
        == 200
    )
    settings.openai_api_key = "mock-key"
    settings.openai_model = "configured-test-model"
    return a, b, settings, job


def discovery(
    oid="backend-intern",
    rid="python-tutorial",
    minutes=60,
    reason="Relevant to your Python aspiration.",
):
    return engine.DiscoveryOutput(
        aspiration_summary="Build toward backend development",
        priority_skills=["SQL"],
        resources=[
            engine.ResourceChoice(
                resource_id="python-tutorial", reason="Practise Python functions."
            )
        ],
        opportunities=[
            engine.OpportunityChoice(
                opportunity_id=oid,
                reason=reason,
                gap="Clarify SQL evidence",
                resource_id=rid,
                next_action="Build a small command-line tool with example inputs.",
                minutes=minutes,
            )
        ],
    )


def test_unconfigured_ai_is_labelled(clients):
    a, _, _, _ = clients
    result = a.get("/api/v1/recommendations").json()
    assert result["engine"] == "rule-based fallback"
    assert result["fallback_reason"] == "Set your goal first"
    assert result["model"] is None


def test_openai_discovery_grounds_ids_and_reuses_cache(clients, monkeypatch):
    a, _, _, _ = setup_learner(clients)
    calls = []

    async def parse(kind, payload, schema):
        calls.append(payload)
        assert kind == "discovery"
        assert payload["learner"]["profile"]["goal"] == PROFILE["goal"]
        assert "name" not in payload["learner"]["profile"]
        return discovery()

    monkeypatch.setattr(engine, "parse_output", parse)
    first = a.get("/api/v1/recommendations")
    assert first.status_code == 200, first.text
    result = first.json()
    assert result["engine"] == "OpenAI" and result["model"] == "configured-test-model"
    assert result["aspiration_summary"] == PROFILE["goal"]
    match = result["opportunities"][0]
    assert match["opportunity"]["url"] == "https://example.com/backend"
    assert "Matches your goal" in match["reasons"][0]
    assert match["learning_resource"]["id"] == "python-tutorial"
    assert match["minutes"] <= PROFILE["hours"] * 60
    assert a.get("/api/v1/recommendations").json()["cached"]
    assert len(calls) == 1
    a.post("/api/v1/weeks/1/check-in", json={"status": "done"})
    assert a.get("/api/v1/recommendations").json()["engine"] == "OpenAI"
    assert len(calls) == 2


def test_ai_discovery_cannot_choose_valid_but_irrelevant_catalogue_items(
    clients, monkeypatch
):
    a, _, _, _ = setup_learner(clients)
    unrelated = {
        "title": "Frontend developer",
        "organisation": "Example provider",
        "type": "Internship",
        "country": "Rwanda",
        "skills": ["HTML", "JavaScript"],
        "description": "Build websites with HTML and JavaScript.",
        "mandatory": "Confirm eligibility",
        "sample": False,
        "url": "https://example.com/frontend",
        "deadline": "2099-12-31",
    }
    assert (
        a.put(
            "/api/v1/admin/content/opportunities/frontend-intern",
            headers=ADMIN,
            json={"status": "published", "data": unrelated},
        ).status_code
        == 200
    )
    prompt_job_ids = []

    async def parse(kind, payload, schema):
        prompt_job_ids.extend(item["id"] for item in payload["opportunities"])
        return discovery(oid="frontend-intern")

    monkeypatch.setattr(engine, "parse_output", parse)
    result = a.get("/api/v1/recommendations").json()

    assert prompt_job_ids == ["backend-intern"]
    assert result["engine"] == "rule-based fallback"
    assert result["opportunities"][0]["opportunity"]["id"] == "backend-intern"


@pytest.mark.parametrize(
    "kwargs",
    [
        {"oid": "invented-job"},
        {"rid": "invented-resource"},
        {"minutes": 121},
        {"reason": "Read https://invented.example.com"},
    ],
)
def test_invalid_model_output_falls_back(clients, monkeypatch, kwargs):
    a, _, _, _ = setup_learner(clients)

    async def parse(*args):
        return discovery(**kwargs)

    monkeypatch.setattr(engine, "parse_output", parse)
    result = a.get("/api/v1/recommendations").json()
    assert result["engine"] == "rule-based fallback"
    assert "validation" in result["fallback_reason"]
    assert all(
        item["opportunity"]["id"] != "invented-job" for item in result["opportunities"]
    )


def test_ai_failure_backoff_and_input_minimisation(clients, monkeypatch):
    a, _, _, _ = setup_learner(clients)
    content = "Education\nUniversity student\nSkills\nPython SQL\nProjects\nBuilt a Python tracker for 100 records. Experience\nHelped a team analyse survey data."
    assert (
        a.post(
            "/api/v1/me/cv-reviews",
            json={
                "filename": "private-name.txt",
                "content_base64": base64.b64encode(content.encode()).decode(),
                "goal": "Backend internship",
            },
        ).status_code
        == 200
    )
    calls = []

    async def broken(kind, payload, schema):
        calls.append(payload)
        assert "SQL" in payload["learner"]["cv_skill_mentions"]
        serialized = str(payload)
        assert "private-name.txt" not in serialized and content not in serialized
        assert "extracted_preview" not in serialized
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(engine, "parse_output", broken)
    assert a.get("/api/v1/recommendations").json()["engine"] == "rule-based fallback"
    assert a.get("/api/v1/recommendations").json()["engine"] == "rule-based fallback"
    assert len(calls) == 1


def test_fit_uses_cv_signals_and_validated_resources(clients, monkeypatch):
    a, _, _, _ = setup_learner(clients)

    async def parse(kind, payload, schema):
        assert kind == "fit"
        assert "Python" in payload["learner"]["mentioned_skills"]
        return engine.FitOutput(
            minutes=60,
            explanation="Your Python mention is a starting signal; show SQL evidence.",
            next_actions=["Document a small Python tool."],
            resources=[
                engine.ResourceChoice(
                    resource_id="python-tutorial",
                    reason="Practise functions before a larger project.",
                )
            ],
        )

    monkeypatch.setattr(engine, "parse_output", parse)
    response = a.get("/api/v1/opportunities/backend-intern/assessment")
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["engine"] == "OpenAI"
    assert result["learning_resources"][0]["resource"]["url"].startswith(
        "https://docs.python.org/"
    )
    assert any(
        item["requirement"] == "Python" and "not verified" in item["evidence"]
        for item in result["supported"]
    )
    assert result["deadline"] == "2099-12-31"


def test_candidates_filter_restrictions_before_model():
    profile = {"country": "Rwanda"}
    jobs = [
        {"id": "a", "country": "Nigeria"},
        {"id": "b", "country": "Global", "deadline": "2000-01-01"},
        {"id": "c", "country": "Rwanda", "availability": "closed"},
        {"id": "d", "country": "Global"},
    ]
    resources = [{"id": "paid", "cost": "Paid"}, {"id": "free", "cost": "Free guides"}]
    learning, eligible = engine.candidates(profile, resources, jobs)
    assert [j["id"] for j in eligible] == ["d"]
    assert [r["id"] for r in learning] == ["free"]


def test_sdk_request_uses_structured_output_and_no_storage(monkeypatch):
    requests = []

    class Client:
        def __init__(self, **kwargs):
            self.responses = self

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def parse(self, **kwargs):
            requests.append(kwargs)
            return SimpleNamespace(output_parsed=discovery())

    monkeypatch.setattr(engine, "AsyncOpenAI", Client)
    result = asyncio.run(
        engine.parse_output(
            "discovery", {"learner": {"goal": "Python"}}, engine.DiscoveryOutput
        )
    )
    assert result.opportunities[0].opportunity_id == "backend-intern"
    assert requests[0]["store"] is False
    assert requests[0]["text_format"] is engine.DiscoveryOutput
    assert "untrusted data" in requests[0]["instructions"]
