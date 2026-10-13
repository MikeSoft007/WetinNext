import asyncio
from app.services.matching import intelligence as engine
from app.services.matching.recommendations import recommend


def test_ai_can_choose_beyond_two_rule_based_resources(clients, monkeypatch):
    client, _, settings, _ = clients
    profile = {
        "name": "Test",
        "goal": "Become a backend developer",
        "career_track": "backend",
        "country": "Rwanda",
        "hours": 3,
        "device": "laptop",
        "low_data": False,
    }
    client.put("/api/v1/me/profile", json=profile)
    settings.openai_api_key = "mock"
    settings.openai_model = "bundle-test"
    seen = []

    async def parse(kind, payload, schema):
        seen.extend(r["id"] for r in payload["resources"])
        assert len(seen) > 2
        return engine.DiscoveryOutput(
            aspiration_summary="Backend preparation",
            priority_skills=["Testing"],
            resources=[
                engine.ResourceChoice(
                    resource_id=seen[-1], reason="A specific practice source."
                )
            ],
            opportunities=[],
            focus="Check your Python tool",
            deliverable="Save three test cases and explain one failing input.",
            rationale="Build on declared Python with a three-hour practice session.",
        )

    monkeypatch.setattr(engine, "parse_output", parse)
    result = client.get("/api/v1/recommendations?country=Rwanda").json()
    assert result["engine"] == "OpenAI"
    assert result["priority_skills"] == ["Testing"]
    assert result["bundle"]["deliverable"].startswith("Save three")
    assert result["resources"][0]["resource"]["id"] == seen[-1]


def test_unsupported_goal_is_interpreted_without_generic_course_substitution(
    clients, monkeypatch
):
    client, _, settings, _ = clients
    client.put(
        "/api/v1/me/profile",
        json={
            "name": "Test",
            "goal": "Become a pastry chef",
            "country": "Rwanda",
            "hours": 3,
            "device": "laptop",
        },
    )
    settings.openai_api_key = "mock"
    settings.openai_model = "chef-test"
    calls = []

    async def parse(kind, payload, schema):
        calls.append(kind)
        if kind == "intent":
            return engine.GoalIntent(
                role="Pastry chef", skills=["Baking", "Food safety"], clarification=""
            )
        assert payload["resources"] == [] and payload["opportunities"] == []
        return engine.DiscoveryOutput(
            aspiration_summary="Pastry preparation",
            priority_skills=["Food safety"],
            resources=[],
            opportunities=[],
            focus="Clarify your starting point",
            deliverable="List your kitchen access and prior baking practice.",
            rationale="No suitable catalogue content is available yet.",
        )

    monkeypatch.setattr(engine, "parse_output", parse)
    result = client.get("/api/v1/recommendations?country=Rwanda").json()
    assert calls == ["intent", "discovery"]
    assert result["resources"] == [] and result["opportunities"] == []
    assert result["coverage"]["resources"] == 0


def test_transferable_skill_only_resources_do_not_fill_career_bundle():
    result = recommend(
        {"profile": {"goal": "Digital marketing", "country": "Nigeria"}},
        [],
        [
            {
                "id": "generic",
                "title": "Communication foundations",
                "skills": ["Communication"],
                "cost": "Free",
                "format": "Text",
            }
        ],
        [],
    )
    assert result["resources"] == []
