import { navigateApp } from "../../app/useSectionRoute";
import { ArrowRight, Check, Flag, Sprout } from "lucide-react";
import type { State } from "../../shared/types";
export default function ProgressOverview({
  state,
  onStart,
  onContinue,
}: {
  state: State | null;
  onStart: () => void;
  onContinue: () => void;
}) {
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
          <span className="public-eyebrow">YOUR SPRINT AT A GLANCE</span>
          <h2>{state?.profile.goal}</h2>
          <p className="privacy-note">
            Complete tasks on Today, save a reflection or link, then check in.
            Your skills and weekly progress update here.
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
        <div
          className="progress-ring"
          style={{
            background: `conic-gradient(#38776d ${completed * 25}%, #edf2ef 0)`,
          }}
        >
          <div>
            <strong>
              {completed}
              <small>/4</small>
            </strong>
            <span>weeks complete</span>
          </div>
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
            </li>
          );
        })}
      </ol>
    </section>
  );
}
