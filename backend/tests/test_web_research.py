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


def test_opening_skills_are_optional_and_bounded():
    opening = r.Opening(
        title="Data assistant",
        provider="Example",
        location="Kigali",
        url="https://example.edu/role",
        type="Internship",
        eligibility="Early-career applicants.",
        deadline_note="Apply by the listed date.",
        availability_note="Applications open.",
        open_status="unknown",
        open_evidence="",
        deadline=None,
        published_date=None,
    )
    assert opening.required_skills == []
    opening.required_skills = ["Spreadsheets", "Data analysis"]
    assert opening.model_dump()["required_skills"] == [
        "Spreadsheets",
        "Data analysis",
    ]
    invalid = opening.model_dump()
    invalid["required_skills"] = [f"Skill {index}" for index in range(9)]
    with pytest.raises(ValueError):
        r.Opening(**invalid)


def test_citation_grounding_costs_and_regulated_plan():
    g = guide()
    g.places.append(
        r.Place(
            name="Search results, not an institution",
            kind="School",
            location="Kigali",
            url="https://www.google.com/search?q=nursing+schools",
            entry_route="Search result only.",
            cost_note="Unknown.",
            availability_note="Unknown.",
            accreditation_note="Unknown.",
        )
    )
    g.opportunities.append(
        r.Opening(
            title="Search results, not an opportunity",
            provider="Search engine",
            location="Kigali",
            url="https://www.google.com/url?q=https%3A%2F%2Fexample.edu%2Fjobs",
            type="Job",
            eligibility="Unknown.",
            deadline_note="Unknown.",
            availability_note="Unknown.",
            open_status="unknown",
            open_evidence="",
            deadline=None,
            published_date=None,
        )
    )
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
        r.canonical_url("https://www.google.com/search?q=nursing+schools"): {},
        r.canonical_url(
            "https://www.google.com/url?q=https%3A%2F%2Fexample.edu%2Fjobs"
        ): {},
    }
    result = r.validate_guide(g, sources, PROFILE)
    assert [x["id"] for x in result["resources"]] == ["anatomy"]
    assert [x["url"] for x in result["places"]] == ["https://example.edu/nursing"]
    assert result["opportunities"] == []
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
            if kwargs.get("text_format") is r.DiscoveryExpansion:
                return SimpleNamespace(
                    output_parsed=r.DiscoveryExpansion(
                        places=guide().places,
                        opportunities=[
                            r.Opening(
                                title="Nursing scholarship",
                                provider="Example school",
                                location="Kigali",
                                url="https://example.edu/nursing",
                                type="Scholarship",
                                eligibility="Confirm school requirements",
                                required_skills=[],
                                deadline_note="Apply by deadline",
                                availability_note="Applications open",
                                open_status="current_open",
                                open_evidence="Applications open; apply by deadline",
                                deadline="2099-01-01",
                                published_date=None,
                            )
                        ],
                    )
                )
            initial = guide()
            initial.places = []
            return SimpleNamespace(output_parsed=initial)

    monkeypatch.setattr(r, "AsyncOpenAI", FakeClient)
    result = asyncio.run(r.build_guide(PROFILE, "Kigali", "Rwanda", lambda _: None))
    assert len(calls) == 4 and all(c["tools"][0]["type"] == "web_search" for c in calls)
    assert len(result["sources"]) == 2 and len(result["weeks"]) == 4
    assert len(result["places"]) == 1 and len(result["opportunities"]) == 1
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
    assert counts == {"search": 4, "parse": 3}
    assert inputs[1]["correction"].startswith("Invalid plan resource or effort")
    assert result["weeks"][0]["resource_id"] == "anatomy"


def test_streamed_orientation_is_previewed_without_exposing_unverified_links():
    from types import SimpleNamespace
    from app.services.matching.research import stream_guide

    previews = []
    final = SimpleNamespace(output_parsed="final")

    class Stream:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            pass

        def __aiter__(self):
            async def events():
                yield SimpleNamespace(
                    type="response.output_text.delta",
                    parsed={
                        "orientation": "Learn cloud foundations",
                        "resources": [{"url": "https://unverified.invalid"}],
                    },
                )

            return events()

        async def get_final_response(self):
            return final

    client = SimpleNamespace(responses=SimpleNamespace(stream=lambda **_: Stream()))

    def stage(_):
        pass

    stage.draft = previews.append
    result = asyncio.run(stream_guide(client, stage, model="test"))
    assert result is final
    assert previews == ["Learn cloud foundations"]


def test_paid_resources_are_separate_and_never_used_as_free_plan_sources():
    g = guide()
    paid_url = "https://example.org/paid-course"
    g.paid_resources = [
        r.LearningSource(
            id="paid",
            title="Paid study option",
            provider="Example",
            url=paid_url,
            format="Online course",
            access_note="Payment required",
            why_it_fits="Additional supported learning",
            skill="Anatomy",
            access_type="paid_program",
            cost_evidence="Provider states payment required",
        )
    ]
    result = r.validate_guide(
        g,
        {
            r.canonical_url(URL): {"url": URL, "title": "Free lesson"},
            r.canonical_url(paid_url): {"url": paid_url, "title": "Paid study option"},
        },
        PROFILE,
    )
    assert result["paid_resources"][0]["id"] == "paid"
    assert all(week["resource_id"] != "paid" for week in result["weeks"])
    assert all(
        resource["access_type"] == "free_content" for resource in result["resources"]
    )


def test_online_training_route_is_kept_and_not_relabelled_as_local_campus():
    g = guide()
    g.places[0].location = "Online"
    result = r.validate_guide(
        g, {r.canonical_url(URL): {}, r.canonical_url(g.places[0].url): {}}, PROFILE
    )
    assert result["places"][0]["location"] == "Online"
