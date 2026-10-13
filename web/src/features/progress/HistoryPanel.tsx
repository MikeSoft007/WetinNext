import { LocalCollection } from "../../shared/ui/Collection";
import { History, Check, CalendarClock, ArrowRight } from "lucide-react";
import type { HistoryEntry } from "../../shared/types";
export function HistoryPanel({
  history,
  country,
  onPathway,
}: {
  history: HistoryEntry[];
  country?: string;
  onPathway: () => void;
}) {
  return (
    <section className="card history-card">
      <div className="card-heading">
        <span className="icon-box">
          <History size={19} />
        </span>
        <div>
          <h2>Your learning journal</h2>
          <p>
            Completed tasks, difficult moments, and the steps you kept taking.
          </p>
        </div>
        <span className="badge slate">{history.length} ENTRIES</span>
      </div>
      {history.length ? (
        <LocalCollection items={history} label="check-ins">
          {(visible) =>
            visible.map((h, i) => (
              <article
                className="history-row"
                key={(h.updated_at ?? "legacy") + i}
              >
                <span
                  className={
                    "history-icon " + (h.status === "done" ? "green" : "amber")
                  }
                >
                  {h.status === "done" ? (
                    <Check size={17} />
                  ) : (
                    <CalendarClock size={17} />
                  )}
                </span>
                <div>
                  <div className="history-title">
                    <h3>
                      Week {h.week} ·{" "}
                      {h.status === "done"
                        ? "Task completed"
                        : h.status === "stuck"
                          ? "Difficulty reported"
                          : "More time requested"}
                    </h3>
                    <time>
                      {h.updated_at
                        ? new Date(h.updated_at).toLocaleString("en-GB", {
                            timeZone:
                              country === "Nigeria"
                                ? "Africa/Lagos"
                                : "Africa/Kigali",
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "Earlier check-in"}
                    </time>
                  </div>
                  {h.note && <p className="reflection-note">“{h.note}”</p>}
                  <p>{h.advice}</p>
                  {h.legacy && (
                    <small>
                      Latest available record from before history tracking was
                      added.
                    </small>
                  )}
                </div>
              </article>
            ))
          }
        </LocalCollection>
      ) : (
        <div className="empty-state">
          <History size={30} />
          <h3>Your next check-in starts the story.</h3>
          <p>Log a completed task or a difficulty from your pathway.</p>
          <button className="primary" onClick={() => onPathway()}>
            Go to my pathway <ArrowRight size={15} />
          </button>
        </div>
      )}
    </section>
  );
}
