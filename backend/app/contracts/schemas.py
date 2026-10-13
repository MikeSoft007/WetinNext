from typing import Literal
from pydantic import BaseModel, Field, field_validator


class Profile(BaseModel):
    @field_validator("name", "goal", "background", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    name: str = Field(min_length=1, max_length=80)
    learner_type: Literal["student", "self-taught", "both"] = "student"
    country: Literal["Nigeria", "Rwanda", "Other"] = "Nigeria"
    goal: str = Field(min_length=5, max_length=500)
    hours: int = Field(ge=1, le=20)
    device: Literal["laptop", "phone"] = "laptop"
    background: str = Field(default="", max_length=1000)
    low_data: bool = True
    career_track: Literal[
        "auto",
        "infrastructure",
        "data",
        "frontend",
        "backend",
        "cybersecurity",
        "marketing",
        "support",
        "project",
        "scholarship",
        "foundation",
    ] = "auto"


class CheckIn(BaseModel):
    status: Literal["done", "stuck", "more-time"]
    note: str = Field(default="", max_length=1000)


class ApplicationUpdate(BaseModel):
    status: Literal[
        "interested",
        "preparing",
        "applied",
        "interviewing",
        "offer",
        "rejected",
        "closed",
        "withdrawn",
    ]
    notes: str | None = Field(default=None, max_length=2000)


class PreparationUpdate(BaseModel):
    action: str = Field(min_length=1, max_length=700)
    completed: bool


class AIWeek(BaseModel):
    week: int
    title: str
    task: str
    success: str
    resource_id: str
    minutes: int


class AIPlan(BaseModel):
    title: str
    outcome: str
    weeks: list[AIWeek]


class ProfileAdjustment(BaseModel):
    hours: int = Field(ge=1, le=20)
    device: Literal["laptop", "phone"]
    low_data: bool


class Resource(BaseModel):
    data_usage: str = "unknown"
    low_data_suitable: bool = False
    data_note: str = "Data use is unverified."
    learning_outcomes: list[str] = Field(default_factory=list)
    sample_exercise: str = ""
    suggested_session_minutes: int = 20
    prerequisites: str = "Check provider requirements."
    skills: list[str] = Field(default_factory=list)
    source: str | None = None
    fetched_at: str | None = None
    id: str
    title: str
    provider: str
    url: str
    format: str
    device: str
    cost: str
    review: str


class Opportunity(BaseModel):
    source_text: str = Field(default="", max_length=7000)
    source_changed_at: str | None = None
    source_changed_fields: list[str] = Field(default_factory=list)
    availability: str = "unknown"
    last_checked_at: str | None = None
    source_seen_at: str | None = None
    last_check_result: str | None = None
    source_snapshot: dict | None = None
    missing_checks: int = 0
    source: str | None = None
    source_id: str | None = None
    fetched_at: str | None = None
    geography: str | None = None
    seniority: str | None = None
    deadline_unknown_confirmed: bool = False
    id: str
    title: str
    organisation: str
    type: str
    country: str
    skills: list[str]
    description: str
    mandatory: str
    sample: bool
    url: str | None
    deadline: str | None


class SupportedRequirement(BaseModel):
    requirement: str
    evidence: str


class SkillGap(BaseModel):
    requirement: str
    reason: str


class MatchingAssessment(BaseModel):
    engine: str = "rule-based fallback"
    model: str | None = None
    fallback_reason: str | None = None
    cached: bool = False
    learning_resources: list[dict] = Field(default_factory=list)
    minutes: int | None = None
    label: str
    sample: bool
    supported: list[SupportedRequirement]
    gaps: list[SkillGap]
    strength: str
    gap: str
    actions: list[str]
    deadline: str | None
    deadline_notice: str
    honest_guide: list[str]
    notice: str


class Pathway(AIPlan):
    resources: list[Resource] = Field(default_factory=list)
    research_id: str | None = None
    research_guide: dict | None = None
    id: str | None = None
    engine: str
    notice: str
    revision: int = 1


class LearnerState(BaseModel):
    goal_id: str | None = None
    needs_goal_research: bool = False
    profile: dict
    plan: Pathway | None
    progress: dict
    applications: dict[str, str]
    metrics: dict[str, int]


class CVUpload(BaseModel):
    filename: str = Field(max_length=160)
    content_base64: str = Field(max_length=7_000_000)
    goal: str = Field(default="", max_length=500)
    opportunity_id: str = Field(default="", max_length=80)


class ContentEdit(BaseModel):
    status: Literal["draft", "published", "archived"] = "draft"
    data: dict


from urllib.parse import urlparse


class WorkUpdate(BaseModel):
    checklist: dict[str, bool] = Field(default_factory=dict, max_length=3)
    evidence_url: str = Field(default="", max_length=1000)
    reflection: str = Field(default="", max_length=2000)

    @field_validator("evidence_url")
    @classmethod
    def safe_url(cls, value):
        value = value.strip()
        parsed = urlparse(value)
        if value and (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
        ):
            raise ValueError("Use an HTTPS project link without credentials.")
        return value


from urllib.parse import urlsplit


class ExternalJob(BaseModel):
    url: str = Field(max_length=1000)
    description: str = Field(min_length=80, max_length=20000)

    @field_validator("url")
    @classmethod
    def linkedin_url(cls, value):
        parsed = urlsplit(value.strip())
        if (
            parsed.scheme != "https"
            or parsed.hostname not in {"linkedin.com", "www.linkedin.com"}
            or not parsed.path.startswith("/jobs/")
            or parsed.username
            or parsed.password
            or parsed.port not in {None, 443}
        ):
            raise ValueError("Use an HTTPS LinkedIn jobs link.")
        return value.strip()


class ResearchRequest(BaseModel):
    refresh: bool = False
    education: Literal["not_shared", "secondary", "diploma", "degree"] = "not_shared"
    budget: Literal["free_only", "affordable", "flexible"] = "free_only"
    city: str = Field(default="", max_length=100)
    market: Literal["Nigeria", "Rwanda", "Global"] = "Nigeria"


class ResearchAdoption(BaseModel):
    research_id: str = Field(pattern=r"^[a-f0-9]{32}$")


class QuizSettings(BaseModel):
    time_limit_minutes: int = Field(default=0, ge=0, le=60)
    question_count: int = Field(default=4, ge=1, le=20)
    difficulty: Literal["beginner", "intermediate", "advanced"] = "beginner"


class QuizBuild(QuizSettings):
    goal: str = Field(min_length=5, max_length=500)
    resources: list[dict] = Field(min_length=1, max_length=12)


class QuizAnswer(BaseModel):
    answers: list[int | None] = Field(min_length=1, max_length=20)

    @field_validator("answers")
    @classmethod
    def valid_answers(cls, value):
        if any(x is not None and not 0 <= x <= 3 for x in value):
            raise ValueError("Choose one of four answers.")
        return value


class ReminderSettings(BaseModel):
    enabled: bool = False
    days: list[int] = Field(default_factory=lambda: [0, 3], min_length=1, max_length=7)
    time: str = Field(default="18:00", pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    timezone: str = "Africa/Kigali"
    focus: str = Field(default="weekly practice", max_length=120)

    @field_validator("days")
    @classmethod
    def valid_days(cls, value):
        if any(day < 0 or day > 6 for day in value):
            raise ValueError("Choose weekdays 0 to 6.")
        return sorted(set(value))

    @field_validator("timezone")
    @classmethod
    def valid_zone(cls, value):
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Choose a valid timezone.")
        return value
