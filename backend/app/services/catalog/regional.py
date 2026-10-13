"""Fixed regional sources. Portals are directories, not asserted open vacancies."""

import hashlib
import json
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser
import httpx
from app.core.config import settings
from app.core.skills import skills_in
from .store import now

DIRECTORIES = [
    {
        "id": "ng-scholarships",
        "country": "Nigeria",
        "title": "Federal scholarship portal",
        "kind": "Scholarships",
        "organisation": "Federal Ministry of Education",
        "url": "https://scholarship.education.gov.ng/",
        "notice": "Official scholarship directory. Confirm the current call, eligibility and deadline; registration may be required.",
    },
    {
        "id": "ng-3mtt",
        "country": "Nigeria",
        "title": "3MTT technical training",
        "kind": "Training",
        "organisation": "NITDA / Federal Ministry of Communications",
        "url": "https://3mtt.nitda.gov.ng/",
        "notice": "Official programme portal. Cohort dates, selection and placement are not guaranteed.",
    },
    {
        "id": "rw-hec",
        "country": "Rwanda",
        "title": "HEC scholarship announcements",
        "kind": "Scholarships",
        "organisation": "Higher Education Council",
        "url": "https://www.hec.gov.rw/updates/scholarships",
        "notice": "Official announcements, including older calls and study loans. Read the original notice for current eligibility and deadlines.",
    },
    {
        "id": "rw-kora",
        "country": "Rwanda",
        "title": "Kora jobs and internships",
        "kind": "Jobs & internships",
        "organisation": "Rwanda Development Board",
        "url": "https://jobportal.kora.rw/",
        "notice": "Official job portal; registration may be required. Individual vacancies are not imported from this directory.",
    },
    {
        "id": "rw-internship",
        "country": "Rwanda",
        "title": "National professional internship programme",
        "kind": "Internships",
        "organisation": "Rwanda Development Board",
        "url": "https://www.internship.rw/",
        "notice": "Official internship portal. Check current placements and programme eligibility; account access may be required.",
    },
]


def read(client, method, url, **kwargs):
    with client.stream(method, url, **kwargs) as response:
        response.raise_for_status()
        data = bytearray()
        for chunk in response.iter_bytes():
            data.extend(chunk)
            if len(data) > 4_000_000:
                raise ValueError("Source response too large")
    return bytes(data)


def normalize_reliefweb(item):
    from .ingestion import text

    f = item.get("fields") or {}
    countries = {c.get("name") for c in f.get("country", [])}
    # Multiple-country listings need review rather than claiming worldwide eligibility.
    if len(countries) != 1 or not countries <= {"Nigeria", "Rwanda"}:
        return None
    country = next(iter(countries))
    link = f.get("url", "")
    parsed = urlparse(link)
    if (
        parsed.scheme != "https"
        or parsed.hostname != "reliefweb.int"
        or not parsed.path.startswith("/job/")
        or not str(item.get("id", "")).isdigit()
    ):
        return None
    closing = (f.get("date") or {}).get("closing")
    if closing:
        from datetime import datetime

        closing = (
            datetime.fromisoformat(closing.replace("Z", "+00:00")).date().isoformat()
        )
    title = text(f.get("title"))[:200]
    body = text(f.get("body"))[:7000]
    categories = ", ".join(text(c.get("name")) for c in f.get("career_categories", []))
    experience = ", ".join(text(e.get("name")) for e in f.get("experience", []))
    return {
        "id": "reliefweb-" + str(item["id"]),
        "source_id": str(item["id"]),
        "source": "ReliefWeb",
        "title": title,
        "organisation": ", ".join(text(s.get("name")) for s in f.get("source", []))[
            :200
        ],
        "country": country,
        "geography": country,
        "skills": skills_in(title + " " + body + " " + categories),
        "description": body[:1500],
        "source_text": body,
        "mandatory": f"Source experience: {experience or 'not specified'}. {categories}. Confirm work authorisation, language and qualifications on ReliefWeb.",
        "seniority": experience or None,
        "type": ", ".join(text(t.get("name")) for t in f.get("type", [])) or "Job",
        "sample": False,
        "url": link,
        "deadline": closing,
        "deadline_unknown_confirmed": False,
        "fetched_at": now(),
    }


class HECNotices(HTMLParser):
    def __init__(self):
        super().__init__()
        self.notices = {}

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        attrs = dict(attrs)
        link = urljoin("https://www.hec.gov.rw", attrs.get("href", ""))
        parsed = urlparse(link)
        title = attrs.get("title", "").strip()
        if (
            parsed.scheme != "https"
            or parsed.hostname != "www.hec.gov.rw"
            or parsed.username
            or parsed.query
            or not parsed.path.startswith("/fileadmin/user_upload/HEC/Scholarships/")
            or not parsed.path.lower().endswith(".pdf")
            or not title
        ):
            return
        if len(self.notices) >= 30:
            return
        self.notices[link] = {
            "id": "hec-" + hashlib.sha256(link.encode()).hexdigest()[:24],
            "source": "HEC Rwanda",
            "title": title[:200],
            "organisation": "Higher Education Council",
            "country": "Rwanda",
            "geography": "Rwanda",
            "type": "Study loan" if "loan" in title.lower() else "Scholarship",
            "skills": [],
            "sample": False,
            "description": "Official announcement. Application status, subject requirements and closing date need review of the linked notice.",
            "mandatory": "Confirm nationality, academic qualifications, funding terms and deadline in the original PDF. A listed announcement may be expired.",
            "url": link,
            "deadline": None,
            "deadline_unknown_confirmed": False,
            "fetched_at": now(),
        }


def fetch_records(provider):
    with httpx.Client(
        timeout=20,
        follow_redirects=False,
        headers={"User-Agent": "WetinNext/0.1 (public opportunity catalogue)"},
    ) as client:
        if provider == "reliefweb":
            if not settings.reliefweb_appname:
                raise ValueError("Approved ReliefWeb appname required")
            body = json.loads(
                read(
                    client,
                    "POST",
                    "https://api.reliefweb.int/v2/jobs",
                    params={"appname": settings.reliefweb_appname},
                    json={
                        "limit": 100,
                        "profile": "full",
                        "sort": ["date.created:desc"],
                        "filter": {
                            "field": "country.name",
                            "value": ["Nigeria", "Rwanda"],
                            "operator": "OR",
                        },
                    },
                )
            )
            if not isinstance(body.get("data"), list) or body.get("error"):
                raise ValueError("Invalid ReliefWeb response")
            records = [
                normalize_reliefweb(item)
                for item in body["data"]
                if isinstance(item, dict)
            ]
            if body["data"] and not any(records):
                raise ValueError("No valid regional records")
            return records
        robots = read(client, "GET", "https://www.hec.gov.rw/robots.txt").decode(
            "utf-8", errors="replace"
        )
        policy = RobotFileParser()
        policy.parse(robots.splitlines())
        url = "https://www.hec.gov.rw/updates/scholarships"
        if not policy.can_fetch("WetinNext", url):
            raise ValueError("Source does not allow fetching")
        parser = HECNotices()
        parser.feed(read(client, "GET", url).decode("utf-8", errors="replace"))
        if not parser.notices:
            raise ValueError("Scholarship listing structure changed")
        return list(parser.notices.values())
