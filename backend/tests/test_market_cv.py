import base64
import pytest
from app.services.learners.cv import review
from app.services.matching import intelligence

ADMIN = {"X-Admin-Key": "test-admin-key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}


@pytest.mark.parametrize("market", ["Nigeria", "Rwanda", "Global"])
def test_explicit_market_filters_catalog_and_recommendations(clients, market):
    client, _, settings, _ = clients
    settings.openai_api_key = ""
    for country in ["Nigeria", "Rwanda", "Global"]:
        data = {
            "title": "Python backend internship",
            "organisation": "Example",
            "type": "Internship",
            "country": country,
            "skills": ["Python"],
            "description": "Python backend tools",
            "mandatory": "Check location eligibility",
            "sample": False,
            "url": "https://example.com/jobs/" + country,
            "deadline": "2099-12-31",
        }
        assert (
            client.put(
                "/api/v1/admin/content/opportunities/market-" + country,
                headers=ADMIN,
                json={"status": "published", "data": data},
            ).status_code
            == 200
        )
    profile = {
        "name": "Test",
        "goal": "Backend developer",
        "country": "Nigeria",
        "hours": 5,
        "device": "laptop",
        "background": "Python",
        "career_track": "backend",
    }
    assert client.put("/api/v1/me/profile", json=profile).status_code == 200
    listings = client.get("/api/v1/opportunities", params={"country": market}).json()
    assert listings and all(o["country"] == market for o in listings)
    result = client.get("/api/v1/recommendations", params={"country": market})
    assert result.status_code == 200, result.text
    matches = result.json()["opportunities"]
    assert matches and all(m["opportunity"]["country"] == market for m in matches)
    assert client.get("/api/v1/me").json()["profile"]["country"] == "Nigeria"


def test_cv_aliases_new_tracks_and_recommendation_signals(clients):
    client, _, settings, _ = clients
    settings.openai_api_key = ""
    text = "Education University student. Skills Information security, Excel, customer service, marketing. Projects Research and communication. Experience Helped 100 students."
    result = review(
        text,
        "Cybersecurity",
        {"skills": ["Cybersecurity", "Spreadsheets", "Customer support", "Python"]},
    )
    assert set(result["supported"]) == {
        "Cybersecurity",
        "Spreadsheets",
        "Customer support",
    }
    assert result["gaps"] == ["Python"]
    response = client.post(
        "/api/v1/me/cv-reviews",
        json={
            "filename": "synthetic.txt",
            "content_base64": base64.b64encode(text.encode()).decode(),
            "goal": "Cybersecurity",
        },
    )
    assert response.status_code == 200, response.text
    saved = client.get("/api/v1/me/cv-reviews").json()
    context = intelligence.evidence_context(client.get("/api/v1/me").json(), saved, [])
    assert "Cybersecurity" in context["mentioned_skills"]
    assert text not in str(context) and "extracted_preview" not in str(context)
    assert client.get("/api/v1/recommendations?country=Global").status_code == 200
