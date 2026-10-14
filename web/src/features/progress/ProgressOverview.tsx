import { useEffect, useState } from "react";
import { api } from "../../shared/api";
import { navigateApp } from "../../app/useSectionRoute";
import { ArrowRight, Check, Flag, Sprout } from "lucide-react";
import type { State } from "../../shared/types";
export default function ProgressOverview({
  state,
  onStart,
  onContinue,
  onWeekClick,
}: {
  state: State | null;
  onStart: () => void;
  onContinue: () => void;
  onWeekClick?: (week: number) => void;
}) {
  const [signals, setSignals] = useState<{
    evidence_count: number;
    cv_reviewed: boolean;
    practice: { correct: number; total: number } | null;
  } | null>(null);
  useEffect(() => {
    let active = true;
    setSignals(null);
    if (state?.plan)
      api<typeof signals>("/me/readiness")
        .then((value) => {
          if (active && value && typeof value.evidence_count === "number")
            setSignals(value);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [state]);
  const plan = state?.plan;
  const completed = Object.values(state?.progress || {}).filter(
    (p) => p.status === "done",
  ).length;
  if (!plan)
    return (
      <section className="progress-welcome">
        <div className="progress-welcome-art" aria-hidden="true">
          <Sprout size={58} strokeWidth={1.2} />
          <span>01</span>
          <i />
          <span>02</span>
          <i />
          <Flag size={22} />
        </div>
        <span className="public-eyebrow">START SMALL. SEE YOURSELF GROW.</span>
        <h2>
          {state?.profile.goal
            ? "Your direction is set. Let’s shape the path."
            : "Your story starts with one goal."}
        </h2>
        <p>
          {state?.profile.goal ||
            "Create a sprint to track your practice, keep your work and prepare for opportunities."}
        </p>
        {state?.profile.goal ? (
          <a
            className="primary"
            href="/app/discover?view=plan"
            onClick={(e) => {
              e.preventDefault();
              navigateApp("/app/discover?view=plan");
            }}
          >
            Build my researched plan
            <ArrowRight size={16} />
          </a>
        ) : (
          <button className="primary" onClick={onStart}>
            Set my goal
            <ArrowRight size={16} />
          </button>
        )}
        <div className="progress-preview">
          <span>01 · Make a plan</span>
          <span>02 · Keep the evidence</span>
          <span>03 · Take your next step</span>
        </div>
      </section>
    );
  const current = plan.weeks.find(
    (w) => state?.progress[String(w.week)]?.status !== "done",
  );
  return (
    <section className="progress-overview">
      <div className="progress-summary">
        <div>
          <span className="public-eyebrow">CAREER PREPARATION OVERVIEW</span>
          <h2>{state?.profile.goal}</h2>
          <p className="privacy-note">
            Track practical work, skill evidence and application preparation.
            These records support your next step; they do not certify job
            readiness.
          </p>
          <p>
            {current
              ? `Next: ${current.title}`
              : "Sprint complete. Review your work and choose your next step."}
          </p>
          <button className="text-link" onClick={onContinue}>
            {current ? "Continue my week" : "Review my sprint"}
            <ArrowRight size={15} />
          </button>
        </div>
        <div className="progress-ring">
          <div>
            <strong>
              {completed}
              <small>/{plan.weeks.length}</small>
            </strong>
            <span>weeks complete</span>
          </div>
        </div>
      </div>
      <div
        className="career-progress-metrics"
        aria-label="Career preparation signals"
      >
        <div>
          <strong>
            {completed}/{plan.weeks.length}
          </strong>
          <span>Weeks completed</span>
        </div>
        <div>
          <strong>{signals ? signals.evidence_count : "—"}</strong>
          <span>Work evidence saved</span>
        </div>
        <div>
          <strong>
            {signals?.practice
              ? `${signals.practice.correct}/${signals.practice.total}`
              : "Not taken"}
          </strong>
          <span>Latest practice check</span>
        </div>
        <div>
          <strong>
            {signals
              ? signals.cv_reviewed
                ? "Reviewed"
                : "Not reviewed"
              : "—"}
          </strong>
          <span>CV evidence</span>
        </div>
      </div>
      <ol className="progress-milestones">
        {plan.weeks.map((week) => {
          const done = state?.progress[String(week.week)]?.status === "done";
          return (
            <li
              key={week.week}
              className={
                done ? "done" : current?.week === week.week ? "current" : ""
              }
            >
              <button
                className="week-milestone-button"
                onClick={() => onWeekClick?.(week.week)}
                aria-label={`Review week ${week.week}: ${week.title}`}
              >
                <span className="milestone-dot">
                  {done ? <Check size={15} /> : week.week}
                </span>
                <div>
                  <small>WEEK {week.week}</small>
                  <strong>{week.title}</strong>
                  <span>
                    {done
                      ? "Completed"
                      : current?.week === week.week
                        ? "In progress"
                        : "Up next"}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
