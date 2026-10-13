import { Check, ArrowUpRight, BookOpen, Clock3, Route } from "lucide-react";
import type { State, Resource } from "../../shared/types";
export function PathwayTracker({
  state,
  resources,
  onStart,
}: {
  state: State | null;
  resources: Resource[];
  onStart: () => void;
}) {
  const plan = state?.plan;
  const current = plan?.weeks.find(
    (w) => state?.progress[String(w.week)]?.status !== "done",
  )?.week;
  return (
    <section className="card pathway-card">
      <div className="card-heading">
        <span className="icon-box">
          <Route size={19} />
        </span>
        <div>
          <h2>Your first 4-week sprint</h2>
          <p>{plan ? plan.title : "Your starting point, made practical."}</p>
        </div>
        <span className="badge slate">4 WEEKS</span>
      </div>
      {plan ? (
        <div className="week-timeline">
          {plan.weeks.map((w) => {
            const done = state?.progress[String(w.week)]?.status === "done",
              active = w.week === current,
              r = [...(plan.resources || []), ...resources].find(
                (r) => r.id === w.resource_id,
              );
            return (
              <article
                key={w.week}
                className={
                  "week-row " +
                  (active ? "current" : "") +
                  (done ? " completed" : "")
                }
              >
                <span className="week-node">
                  {done ? <Check size={16} /> : String(w.week).padStart(2, "0")}
                </span>
                <div className="week-content">
                  <div className="week-header">
                    <span>WEEK {w.week}</span>
                    <span
                      className={
                        "badge " + (done ? "green" : active ? "teal" : "slate")
                      }
                    >
                      {done ? "Completed" : active ? "In progress" : "Next"}
                    </span>
                  </div>
                  <h3>{w.title}</h3>
                  {active ? (
                    <>
                      <p>{w.task}</p>
                      <div className="completion-criteria">
                        <Check size={14} />
                        <span>{w.success}</span>
                      </div>
                    </>
                  ) : (
                    <p className="week-preview">{w.success}</p>
                  )}
                  <div className="week-links">
                    <span>
                      <Clock3 size={12} />
                      {w.minutes} min
                    </span>
                    {r && (
                      <a href={r.url} target="_blank" rel="noreferrer">
                        <BookOpen size={12} />
                        {r.title}
                        <ArrowUpRight size={12} />
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <Route size={32} />
          <h3>A little direction. A real next step.</h3>
          <p>
            Share your goal, time, and device. Start with a four-week
            spreadsheet project.
          </p>
          <button className="primary" onClick={onStart}>
            Build my pathway <ArrowUpRight size={16} />
          </button>
        </div>
      )}
      <div className="card-footnote">
        <BookOpen size={13} /> Free provider guides. Lesson review and tool
        costs vary.
      </div>
    </section>
  );
}
