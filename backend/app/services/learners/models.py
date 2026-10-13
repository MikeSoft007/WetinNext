from sqlalchemy import String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Learner(Base):
    __tablename__ = "learners"
    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    profile: Mapped[str] = mapped_column(Text, default="{}")
    plan: Mapped[str] = mapped_column(Text, default="null")
    progress: Mapped[str] = mapped_column(Text, default="{}")
    applications: Mapped[str] = mapped_column(Text, default="{}")


class CheckInEvent(Base):
    __tablename__ = "check_in_events"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    learner_id: Mapped[str] = mapped_column(String(128), index=True)
    payload: Mapped[str] = mapped_column(Text)


class PlanRevision(Base):
    __tablename__ = "plan_revisions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    learner_id: Mapped[str] = mapped_column(String(128), index=True)
    payload: Mapped[str] = mapped_column(Text)


class CVReview(Base):
    __tablename__ = "cv_reviews"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    learner_id: Mapped[str] = mapped_column(String(128), index=True)
    payload: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(40))


class OpportunityProgress(Base):
    __tablename__ = "opportunity_progress"
    learner_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    opportunity_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    payload: Mapped[str] = mapped_column(Text, default="{}")


class WeekWork(Base):
    __tablename__ = "week_work"
    learner_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    sprint_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    week: Mapped[int] = mapped_column(primary_key=True)
    payload: Mapped[str] = mapped_column(Text, default="{}")


class AssessmentAttempt(Base):
    __tablename__ = "assessment_attempts"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    learner_id: Mapped[str] = mapped_column(String(128), index=True)
    goal: Mapped[str] = mapped_column(Text)
    sprint_id: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[str] = mapped_column(String(40))
    payload: Mapped[str] = mapped_column(Text)


class GoalWorkspace(Base):
    __tablename__ = "goal_workspaces"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    learner_id: Mapped[str] = mapped_column(String(128), index=True)
    updated_at: Mapped[str] = mapped_column(String(40))
    payload: Mapped[str] = mapped_column(Text)


class GoalReminder(Base):
    __tablename__ = "goal_reminders"
    learner_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    goal_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    payload: Mapped[str] = mapped_column(Text, default="{}")


class LearningPick(Base):
    __tablename__ = "learning_picks"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    learner_id: Mapped[str] = mapped_column(String(128), index=True)
    goal_id: Mapped[str] = mapped_column(String(32), index=True)
    payload: Mapped[str] = mapped_column(Text)
