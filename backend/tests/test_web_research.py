import asyncio
import json
from types import SimpleNamespace
import pytest
from app.services.matching import research as r

URL = "https://www.open.edu/openlearn/open-anatomy"
PROFILE = {
    "name": "Private learner name",
    "goal": "Learn nursing",
    "country": "Rwanda",
    "hours": 2,
    "device": "phone",
    "low_data": True,
    "background": "Private background",
}


def guide():
    return r.Guide(
        title="Your nursing starting point",
        orientation="Begin with anatomy and the route into recognised education.",
        qualification_route="Formal training is required.",
        resources=[
            r.LearningSource(
                id="anatomy",
                title="Anatomy introduction",
                provider="Example university",
                url=URL,
                format="Textbook",
                access_note="Free online reading; print may cost extra.",
                why_it_fits="Introduces body systems.",
                skill="Anatomy",
                access_type="free_content",
                cost_evidence="Free online textbook",
            )
        ],
        places=[
            r.Place(
                name="Example school",
                kind="School",
                location="Kigali",
                url="https://example.edu/nursing",
                entry_route="Confirm entry requirements.",
                cost_note="Tuition unknown.",
                availability_note="No current intake verified.",
                accreditation_note="Not checked.",
            )
        ],
        opportunities=[],
        weeks=[
            r.ResearchWeek(
                week=i,
                title="Study",
                task="Read and summarise theory.",
                success="A saved note.",
                resource_id="anatomy",
                minutes=60,
            )
            for i in range(1, 5)
        ],
        next_question="What is your prior education?",
    )


def test_citation_grounding_costs_and_regulated_plan():
    g = guide()
    g.resources.append(
        r.LearningSource(
            id="paid",
            title="Bachelor of Nursing",
            provider="School",
            url="https://example.edu/nursing",
            format="Degree programme",
            access_note="Tuition applies",
            why_it_fits="Formal training",
            skill="Nursing",
            access_type="paid_program",
            cost_evidence="Tuition applies",
        )
    )
    sources = {
        r.canonical_url(URL): {},
        r.canonical_url("https://example.edu/nursing"): {},
    }
    result = r.validate_guide(g, sources, PROFILE)
    assert [x["id"] for x in result["resources"]] == ["anatomy"]
    assert [x["week"] for x in result["weeks"]] == [1, 2, 3, 4]
    assert all(
        "medication administration" not in w["task"].lower() for w in result["weeks"]
    )
    assert "does not qualify" in result["qualification_route"]
    assert "not verification" in result["places"][0]["accreditation_note"]
    for url in [
        "javascript:alert(1)",
        "http://example.edu",
        "https://127.0.0.1/admin",
        "https://user:pass@example.edu/file",
    ]:
        assert r.canonical_url(url) is None
    with pytest.raises(ValueError):
        r.validate_guide(guide(), {}, PROFILE)


def test_research_job_ownership_minimisation_and_adoption(clients, monkeypatch):
    client, other, settings, _ = clients
    from app.services.matching.api.v1 import routes
    from app.services.learners import research_plan

    monkeypatch.setattr(r, "service_call", routes.service_call)
    monkeypatch.setattr(research_plan, "service_call", routes.service_call)
    r.JOBS.clear()
    assert client.put("/api/v1/me/profile", json=PROFILE).status_code == 200
    settings.openai_api_key = "mock"
    settings.openai_model = "test"
    seen = []

    async def build(profile, city, market, stage):
        seen.append(profile)
        stage("Searching sources")
        result = r.validate_guide(
            guide(),
            {
                r.canonical_url(URL): {},
                r.canonical_url("https://example.edu/nursing"): {},
            },
            profile,
        )
        return {
            **result,
            "goal": profile["goal"],
            "notice": "Introductory learning only.",
            "sources": [{"url": URL, "title": "Textbook"}],
            "location": city + ", " + market,
            "researched_at": "2026-10-13T00:00:00Z",
        }

    monkeypatch.setattr(r, "build_guide", build)
    first = client.post("/api/v1/research", json={"city": "Kigali", "market": "Rwanda"})
    assert first.status_code == 200, first.text
    jid = first.json()["id"]
    state = client.get("/api/v1/research/" + jid).json()
    assert state["status"] == "complete"
    assert seen and "name" not in seen[0] and "background" not in seen[0]
    assert other.get("/api/v1/research/" + jid).status_code == 404
    assert (
        client.post(
            "/api/v1/research", json={"city": "Kigali", "market": "Rwanda"}
        ).json()["id"]
        == jid
    )
    assert (
        client.post("/api/v1/me/research-plan", json={"research_id": jid}).status_code
        == 200
    )
    plan = client.get("/api/v1/me").json()["plan"]
    assert (
        plan["engine"] == "OpenAI + web search" and plan["resources"][0]["url"] == URL
    )
    work = client.get("/api/v1/weeks/1/work").json()
    assert work["resource"]["url"] == URL
    import base64

    text = "Education Secondary school. Skills Anatomy and communication. Projects A study reflection. Experience Helped 100 students organise a study group."
    cv = client.post(
        "/api/v1/me/cv-reviews",
        json={
            "filename": "nursing.txt",
            "content_base64": base64.b64encode(text.encode()).decode(),
            "goal": "Learn nursing",
        },
    ).json()
    assert all(resource["id"] == "anatomy" for resource in cv["suggested_resources"])
    assert cv["actions"][0]["priority"] == "Your goal"
    assert (
        client.post("/api/v1/weeks/1/check-in", json={"status": "done"}).status_code
        == 200
    )
    assert (
        other.post("/api/v1/me/research-plan", json={"research_id": jid}).status_code
        == 404
    )
    assert client.delete("/api/v1/me").status_code == 200
    assert not r.JOBS


def test_research_failure_is_not_presented_as_a_guide(clients, monkeypatch):
    client, _, settings, _ = clients
    from app.services.matching.api.v1 import routes

    monkeypatch.setattr(r, "service_call", routes.service_call)
    r.JOBS.clear()
    client.put("/api/v1/me/profile", json=PROFILE)
    before = client.get("/api/v1/me").json()["plan"]
    settings.openai_api_key = "mock"
    settings.openai_model = "test"

    async def fail(*args):
        raise ValueError("Synthetic provider failure")

    monkeypatch.setattr(r, "build_guide", fail)
    jid = client.post("/api/v1/research", json={"market": "Rwanda"}).json()["id"]
    status = client.get("/api/v1/research/" + jid).json()
    assert status["status"] == "failed" and status["result"] is None
    assert client.get("/api/v1/me").json()["plan"] == before


def test_search_pipeline_combines_three_searches_and_grounded_structure(monkeypatch):
    calls = []

    class FakeClient:
        def __init__(self, **kwargs):
            self.responses = self

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def create(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(
                output_text="A free anatomy source, and official school information.",
                model_dump=lambda: {
                    "output": [
                        {
                            "type": "web_search_call",
                            "action": {
                                "sources": [
                                    {"url": URL, "title": "Anatomy"},
                                    {
                                        "url": "https://example.edu/nursing",
                                        "title": "School",
                                    },
                                ]
                            },
                        }
                    ]
                },
            )

        async def parse(self, **kwargs):
            return SimpleNamespace(output_parsed=guide())

    monkeypatch.setattr(r, "AsyncOpenAI", FakeClient)
    result = asyncio.run(r.build_guide(PROFILE, "Kigali", "Rwanda", lambda _: None))
    assert len(calls) == 3 and all(c["tools"][0]["type"] == "web_search" for c in calls)
    assert len(result["sources"]) == 2 and len(result["weeks"]) == 4
    assert "Private learner name" not in str(calls)


def test_undated_programmes_are_not_open_admissions():
    g = guide()
    g.opportunities = [
        r.Opening(
            title="Nursing diploma",
            provider="Example school",
            location="Kigali",
            url="https://example.edu/nursing",
            type="Admissions",
            eligibility="Confirm requirements.",
            deadline_note="Contact school.",
            availability_note="Programme offered.",
            open_status="current_open",
            open_evidence="Admission details available on website",
            deadline=None,
            published_date=None,
        )
    ]
    result = r.validate_guide(
        g,
        {r.canonical_url(URL): {}, r.canonical_url("https://example.edu/nursing"): {}},
        PROFILE,
    )
    assert result["opportunities"] == []


def test_completed_guide_survives_memory_loss_and_browser_id_loss(clients, monkeypatch):
    client, other, settings, _ = clients
    from app.services.matching.api.v1 import routes

    monkeypatch.setattr(r, "service_call", routes.service_call)
    r.JOBS.clear()
    client.put("/api/v1/me/profile", json=PROFILE)
    settings.openai_api_key = "mock"
    settings.openai_model = "test"

    async def build(profile, city, market, stage):
        result = r.validate_guide(
            guide(),
            {
                r.canonical_url(URL): {},
                r.canonical_url("https://example.edu/nursing"): {},
            },
            profile,
        )
        return {
            **result,
            "goal": profile["goal"],
            "notice": "Theory only.",
            "sources": [],
            "location": "Kigali",
            "researched_at": "2026-10-13T00:00:00Z",
        }

    monkeypatch.setattr(r, "build_guide", build)
    jid = client.post(
        "/api/v1/research", json={"city": "Kigali", "market": "Rwanda"}
    ).json()["id"]
    assert client.get("/api/v1/research/" + jid).json()["status"] == "complete"
    r.JOBS.clear()  # A process restart or TTL eviction loses this memory.
    assert (
        client.get("/api/v1/research/" + jid).json()["result"]["title"]
        == "Your nursing starting point"
    )
    latest = client.get("/api/v1/me/research?market=Rwanda").json()
    assert latest["id"] == jid and latest["status"] == "complete"
    assert other.get("/api/v1/research/" + jid).status_code == 404
    assert client.delete("/api/v1/me").status_code == 200
    r.JOBS.clear()
    client.post("/api/v1/demo/session")
    assert client.get("/api/v1/research/" + jid).status_code == 404


def test_goal_change_removes_unrelated_sprint_and_preserves_cv(clients):
    import base64

    client, _, _, _ = clients
    first = {
        **PROFILE,
        "goal": "Frontend developer",
        "device": "laptop",
        "career_track": "frontend",
    }
    client.put("/api/v1/me/profile", json=first)
    text = "Education University student. Skills HTML CSS. Projects Built a website. Experience Helped 100 students using a project tracker."
    client.post(
        "/api/v1/me/cv-reviews",
        json={
            "filename": "test.txt",
            "content_base64": base64.b64encode(text.encode()).decode(),
            "goal": first["goal"],
        },
    )
    assert (
        client.put(
            "/api/v1/me/goal", json={**PROFILE, "career_track": "auto"}
        ).status_code
        == 200
    )
    current = client.get("/api/v1/me").json()
    assert current["profile"]["goal"] == "Learn nursing" and current["plan"] is None
    assert current["needs_goal_research"]
    result = client.get("/api/v1/recommendations?country=Rwanda").json()
    assert result["resources"] == []
    assert len(client.get("/api/v1/me/cv-reviews").json()) == 1


def test_invalid_plan_is_repaired_once_without_repeating_web_search(monkeypatch):
    counts = {"search": 0, "parse": 0}
    inputs = []

    class FakeClient:
        def __init__(self, **kwargs):
            self.responses = self

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def create(self, **kwargs):
            counts["search"] += 1
            return SimpleNamespace(
                output_text="Free introductory source.",
                model_dump=lambda: {
                    "output": [
                        {
                            "action": {
                                "sources": [
                                    {"url": URL, "title": "Introductory source"}
                                ]
                            }
                        }
                    ]
                },
            )

        async def parse(self, **kwargs):
            counts["parse"] += 1
            inputs.append(json.loads(kwargs["input"]))
            result = guide()
            if counts["parse"] == 1:
                result.weeks[0].resource_id = "not-a-real-resource"
            return SimpleNamespace(output_parsed=result)

    monkeypatch.setattr(r, "AsyncOpenAI", FakeClient)
    result = asyncio.run(
        r.build_guide(
            {**PROFILE, "goal": "Learn anatomy"}, "Kigali", "Rwanda", lambda _: None
        )
    )
    assert counts == {"search": 3, "parse": 2}
    assert inputs[1]["correction"].startswith("Invalid plan resource or effort")
    assert result["weeks"][0]["resource_id"] == "anatomy"
