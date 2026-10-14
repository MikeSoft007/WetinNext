import hashlib, json
from types import SimpleNamespace
from sqlalchemy.orm import Session
from app.services.learners.models import Learner, AssessmentAttempt
from app.services.learners import database, assessments
from app.services.matching import quizzes


def lesson_response():
    return SimpleNamespace(
        output_text="Specific lesson: introductory anatomy concepts.",
        model_dump=lambda: {
            "output": [
                {
                    "action": {
                        "sources": [
                            {
                                "url": "https://example.edu/anatomy/lesson?utm_source=openai",
                                "title": "Anatomy lesson",
                            }
                        ]
                    }
                }
            ]
        },
    )


def test_goal_quiz_private_grading_readiness_and_erasure(clients, monkeypatch):
    client, other, settings, _ = clients
    from app.services.matching.api.v1 import routes

    monkeypatch.setattr(assessments, "service_call", routes.service_call)
    client.put(
        "/api/v1/me/profile",
        json={
            "name": "Test",
            "goal": "Learn nursing",
            "country": "Rwanda",
            "hours": 3,
            "device": "phone",
        },
    )
    assert client.post("/api/v1/me/assessment").status_code == 409
    owner = hashlib.sha256(client.cookies.get("wetinnext_demo").encode()).hexdigest()
    with Session(database.engine) as session:
        row = session.get(Learner, owner)
        row.plan = json.dumps(
            {
                "id": "test-sprint",
                "research_id": "test-research",
                "title": "Nursing introduction",
                "outcome": "Learn theory",
                "engine": "OpenAI + web search",
                "notice": "No clinical qualification",
                "weeks": [],
                "resources": [
                    {
                        "id": "goal-text",
                        "title": "Anatomy theory",
                        "url": "https://example.edu/anatomy",
                        "skills": ["Anatomy"],
                        "review": "Beginner theory",
                    }
                ],
            }
        )
        session.commit()
    settings.openai_api_key = "mock"
    settings.openai_model = "mock"

    class FakeAI:
        def __init__(self, **kwargs):
            self.responses = self

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def create(self, **kwargs):
            return lesson_response()

        async def parse(self, **kwargs):
            return SimpleNamespace(
                output_parsed=quizzes.Quiz(
                    title="Introductory nursing practice",
                    questions=[
                        quizzes.Question(
                            prompt=f"Concept {i}?",
                            options=["A", "B", "C", "D"],
                            correct=i,
                            explanation="An introductory explanation.",
                            source_id="goal-text",
                            source_url="https://example.edu/anatomy/lesson",
                            source_title="Lesson",
                        )
                        for i in range(4)
                    ],
                )
            )

    monkeypatch.setattr(quizzes, "AsyncOpenAI", FakeAI)
    created = client.post("/api/v1/me/assessment")
    assert created.status_code == 200, created.text
    data = created.json()
    assert all("correct" not in q and "explanation" not in q for q in data["questions"])
    assert client.post("/api/v1/me/assessment").json()["id"] == data["id"]
    assert other.get("/api/v1/me/assessment").json() is None
    assert (
        other.post(
            f"/api/v1/me/assessment/{data['id']}/submit", json={"answers": [0, 1, 2, 3]}
        ).status_code
        == 404
    )
    result = client.post(
        f"/api/v1/me/assessment/{data['id']}/submit", json={"answers": [0, 1, 0, 3]}
    ).json()
    assert (
        result["result"]["feedback"][2]["selected_answer"] == "A"
        and result["result"]["feedback"][2]["answer"] == "C"
    )
    assert (
        result["result"]["feedback"][2]["source"]["url"]
        == "https://example.edu/anatomy/lesson"
    )
    assert result["result"]["feedback"][2]["source"]["specific_reference"]
    assert (
        result["result"]["correct"] == 3
        and "not a validated exam" in result["result"]["notice"]
    )
    assert (
        client.post(
            f"/api/v1/me/assessment/{data['id']}/submit", json={"answers": [0, 1, 2, 3]}
        ).json()["result"]["correct"]
        == 3
    )
    summary = client.get("/api/v1/me/readiness").json()
    assert (
        summary["practice"]["correct"] == 3
        and summary["qualification_status"] == "Not verified"
    )
    assert client.delete("/api/v1/me").status_code == 200
    with Session(database.engine) as session:
        assert session.get(AssessmentAttempt, data["id"]) is None


def test_custom_quiz_settings_exact_count_and_dynamic_grading(clients, monkeypatch):
    client, _, settings, _ = clients
    from app.services.matching.api.v1 import routes

    monkeypatch.setattr(assessments, "service_call", routes.service_call)
    client.put(
        "/api/v1/me/profile",
        json={
            "name": "Test",
            "goal": "Learn nursing",
            "country": "Rwanda",
            "hours": 3,
            "device": "phone",
        },
    )
    owner = hashlib.sha256(client.cookies.get("wetinnext_demo").encode()).hexdigest()
    with Session(database.engine) as session:
        row = session.get(Learner, owner)
        row.plan = json.dumps(
            {
                "id": "custom-sprint",
                "resources": [
                    {
                        "id": "anatomy",
                        "title": "Anatomy theory",
                        "skills": ["Anatomy"],
                        "url": "https://example.edu/anatomy",
                        "review": "Theory",
                    }
                ],
            }
        )
        session.commit()
    settings.openai_api_key = "mock"
    settings.openai_model = "mock"
    seen = []

    class FakeAI:
        def __init__(self, **kwargs):
            self.responses = self

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def create(self, **kwargs):
            return lesson_response()

        async def parse(self, **kwargs):
            seen.append(kwargs)
            count = json.loads(kwargs["input"])["question_count"]
            return SimpleNamespace(
                output_parsed=quizzes.Quiz(
                    title="Practice",
                    questions=[
                        quizzes.Question(
                            prompt=f"Concept {i}",
                            options=["A", "B", "C", "D"],
                            correct=0,
                            explanation="Review theory.",
                            source_id="anatomy",
                            source_url="https://example.edu/anatomy/lesson",
                            source_title="Lesson",
                        )
                        for i in range(count)
                    ],
                )
            )

    monkeypatch.setattr(quizzes, "AsyncOpenAI", FakeAI)
    for count in [1, 7, 20]:
        data = client.post(
            "/api/v1/me/assessment",
            json={"question_count": count, "difficulty": "advanced"},
        ).json()
        assert len(data["questions"]) == count and data["difficulty"] == "advanced"
        assert all("correct" not in q for q in data["questions"])
        assert (
            "advanced" in seen[-1]["instructions"]
            and "never diagnosis" in seen[-1]["instructions"]
        )
        assert (
            client.post(
                f"/api/v1/me/assessment/{data['id']}/submit",
                json={"answers": [0] * (count + 1)},
            ).status_code
            == 422
        )
        result = client.post(
            f"/api/v1/me/assessment/{data['id']}/submit", json={"answers": [0] * count}
        ).json()["result"]
        assert result["total"] == count and result["correct"] == count
        assert client.get("/api/v1/me/readiness").json()["practice"]["total"] == count
    client.post(
        "/api/v1/me/assessment",
        json={"question_count": 6, "difficulty": "intermediate"},
    )
    assert client.get("/api/v1/me/readiness").json()["practice"]["total"] == 20
    for body in [
        {"question_count": 21},
        {"question_count": 0},
        {"difficulty": "expert"},
    ]:
        assert client.post("/api/v1/me/assessment", json=body).status_code == 422


def test_timer_deadline_survives_reads_and_unanswered_grading(clients):
    client, _, _, _ = clients
    client.put(
        "/api/v1/me/profile",
        json={
            "name": "Test",
            "goal": "Learn nursing",
            "country": "Rwanda",
            "hours": 3,
            "device": "phone",
        },
    )
    owner = hashlib.sha256(client.cookies.get("wetinnext_demo").encode()).hexdigest()
    from datetime import datetime, timedelta, timezone

    with Session(database.engine) as session:
        row = session.get(Learner, owner)
        row.plan = json.dumps({"id": "timed-sprint"})
        data = {
            "settings": {
                "question_count": 1,
                "difficulty": "beginner",
                "time_limit_minutes": 5,
            },
            "expires_at": (
                datetime.now(timezone.utc) + timedelta(minutes=5)
            ).isoformat(),
            "resources": [
                {"id": "source", "url": "https://example.edu", "title": "Source"}
            ],
            "quiz": {
                "title": "Timed practice",
                "questions": [
                    {
                        "prompt": "Question",
                        "options": ["A", "B", "C", "D"],
                        "correct": 0,
                        "explanation": "Explanation",
                        "source_id": "source",
                    }
                ],
            },
        }
        session.add(
            AssessmentAttempt(
                id="timed",
                learner_id=owner,
                goal="Learn nursing",
                sprint_id="timed-sprint",
                created_at=datetime.now(timezone.utc).isoformat(),
                payload=json.dumps(data),
            )
        )
        session.commit()
    first = client.get("/api/v1/me/assessment").json()
    assert (
        first["time_limit_minutes"] == 5 and first["expires_at"] == data["expires_at"]
    )
    assert (
        client.post(
            "/api/v1/me/assessment/timed/submit", json={"answers": [None]}
        ).status_code
        == 422
    )
    with Session(database.engine) as session:
        attempt = session.get(AssessmentAttempt, "timed")
        data["expires_at"] = "2020-01-01T00:00:00+00:00"
        attempt.payload = json.dumps(data)
        session.commit()
    result = client.post(
        "/api/v1/me/assessment/timed/submit", json={"answers": [None]}
    ).json()["result"]
    assert (
        result["time_expired"]
        and result["unanswered"] == 1
        and result["correct"] == 0
        and result["total"] == 1
    )


def test_quiz_rejects_uncited_and_broad_directory_links(clients, monkeypatch):
    import asyncio, pytest
    from fastapi import HTTPException
    from app.contracts.schemas import QuizBuild

    _, _, settings, _ = clients
    settings.openai_api_key = "mock"
    settings.openai_model = "mock"
    selected = {"url": "https://example.edu/uncited"}

    class FakeAI:
        def __init__(self, **kwargs):
            self.responses = self

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def create(self, **kwargs):
            return lesson_response()

        async def parse(self, **kwargs):
            return SimpleNamespace(
                output_parsed=quizzes.Quiz(
                    title="Practice",
                    questions=[
                        quizzes.Question(
                            prompt="Concept?",
                            options=["A", "B", "C", "D"],
                            correct=0,
                            explanation="Theory.",
                            source_id="source",
                            source_url=selected["url"],
                            source_title="Claimed lesson",
                        )
                    ],
                )
            )

    monkeypatch.setattr(quizzes, "AsyncOpenAI", FakeAI)
    body = QuizBuild(
        goal="Learn anatomy",
        question_count=1,
        resources=[
            {"id": "source", "url": "https://example.edu/anatomy", "title": "Anatomy"}
        ],
    )
    for url in [
        "https://example.edu/uncited",
        "https://example.edu/subjects/anatomy",
        "https://example.edu/books/anatomy/pages/index",
        "https://other.edu/anatomy/lesson",
    ]:
        selected["url"] = url
        with pytest.raises(HTTPException) as exc:
            asyncio.run(quizzes.build(body, owner="test"))
        assert exc.value.status_code == 503
        assert "did not match the verified lesson sources" in exc.value.detail


def test_quiz_reports_missing_lesson_citations_safely(clients, monkeypatch, caplog):
    import asyncio
    import pytest
    from fastapi import HTTPException
    from app.contracts.schemas import QuizBuild

    _, _, settings, _ = clients
    settings.openai_api_key = "mock"
    settings.openai_model = "mock"

    class NoSourcesAI:
        def __init__(self, **kwargs):
            self.responses = self

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def create(self, **kwargs):
            return SimpleNamespace(
                output_text="No source citations found.",
                model_dump=lambda: {"output": []},
            )

    monkeypatch.setattr(quizzes, "AsyncOpenAI", NoSourcesAI)
    body = QuizBuild(
        goal="Learn anatomy",
        question_count=1,
        resources=[
            {
                "id": "source",
                "url": "https://example.edu/anatomy",
                "title": "Anatomy",
            }
        ],
    )
    with caplog.at_level("WARNING", logger="app.services.matching.quizzes"):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(quizzes.build(body, owner="test"))

    assert exc.value.status_code == 503
    assert "did not return a verifiable lesson" in exc.value.detail
    assert "ValueError" in caplog.text
    assert "No source citations found" not in caplog.text


def test_quiz_repairs_resource_id_for_verified_lesson(clients, monkeypatch):
    import asyncio
    from app.contracts.schemas import QuizBuild

    _, _, settings, _ = clients
    settings.openai_api_key = "mock"
    settings.openai_model = "mock"
    seen = {}

    class WrongResourceAI:
        def __init__(self, **kwargs):
            self.responses = self

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def create(self, **kwargs):
            return lesson_response()

        async def parse(self, **kwargs):
            seen["schema"] = kwargs["text_format"].model_json_schema()
            seen["input"] = json.loads(kwargs["input"])
            return SimpleNamespace(
                output_parsed=quizzes.Quiz(
                    title="Practice",
                    questions=[
                        quizzes.Question(
                            prompt="Concept?",
                            options=["A", "B", "C", "D"],
                            correct=0,
                            explanation="Theory.",
                            source_id="incorrect-resource",
                            source_url="https://example.edu/anatomy/lesson",
                            source_title="Lesson",
                        )
                    ],
                )
            )

    monkeypatch.setattr(quizzes, "AsyncOpenAI", WrongResourceAI)
    result = asyncio.run(
        quizzes.build(
            QuizBuild(
                goal="Learn anatomy",
                question_count=1,
                resources=[
                    {
                        "id": "anatomy-source",
                        "url": "https://example.edu/anatomy",
                        "title": "Anatomy",
                    }
                ],
            ),
            owner="test",
        )
    )

    assert result["questions"][0]["source_id"] == "anatomy-source"
    assert (
        result["questions"][0]["source_url"] == "https://example.edu/anatomy/lesson"
    )
    source_schema = seen["schema"]["$defs"]["VerifiedSourceUrl"]
    assert source_schema["enum"] == ["https://example.edu/anatomy/lesson"]
    assert "resources" not in seen["input"]
