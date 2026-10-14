import { useEffect, useState } from "react";
import { Check, ArrowUpRight, FileCheck2, LoaderCircle } from "lucide-react";
import { api } from "../../shared/api";
import type { Resource, State, Week } from "../../shared/types";
import { ResourceDetails } from "../discovery/ResourceCard";
type Work = {
  coach_advice?: string;
  week: number;
  sprint_id: string;
  title: string;
  resource: Resource | null;
  actions: { id: string; title: string; detail: string }[];
  checklist: Record<string, boolean>;
  evidence_url: string;
  reflection: string;
  learning_note?: string;
  practice_example?: string;
  open_question?: string;
  updated_at?: string;
};
export default function WeekWorkbench({
  week,
  planId,
  status,
  readOnly = false,
  compactResponse = false,
  showSource = true,
  onSaved,
}: {
  week: Week;
  planId?: string | null;
  status?: string;
  readOnly?: boolean;
  compactResponse?: boolean;
  showSource?: boolean;
  onSaved?: () => void;
}) {
  const [work, setWork] = useState<Work | null>(null),
    [reflection, setReflection] = useState(""),
    [ideaExpanded, setIdeaExpanded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    setWork(null);
    setError("");
    setMessage("");
    api<Work>(`/weeks/${week.week}/work`)
      .then((data) => {
        if (active) {
          setWork(data);
          setReflection(data.learning_note || data.reflection);
          setIdeaExpanded(false);
        }
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [week.week, planId, status]);
  async function save(checklist = work?.checklist, includeEvidence = true) {
    if (!work || busy || readOnly) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await api<Work>(`/weeks/${week.week}/work`, {
        method: "PUT",
        body: JSON.stringify({
          checklist,
          evidence_url: work.evidence_url,
          reflection: includeEvidence
            ? reflection
            : work.reflection || work.learning_note || "",
          learning_note: includeEvidence
            ? reflection
            : work.learning_note || work.reflection || "",
          practice_example: work.practice_example || "",
          open_question: work.open_question || "",
        }),
      });
      setWork(saved);
      if (includeEvidence) {
        const idea = saved.learning_note || saved.reflection || reflection;
        setReflection(idea);
      }
      setMessage(includeEvidence ? "Your evidence is saved." : "Action saved.");
      if (includeEvidence) setIdeaExpanded(false);
      onSaved?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="week-workbench">
      {error && <p role="alert">{error}</p>}
      {!work && !error ? (
        <p role="status">Opening your weekly workspace…</p>
      ) : (
        work && (
          <>
            <div className="workbench-heading">
              <span className="public-eyebrow">
                LEARN. PRACTISE. KEEP THE EVIDENCE.
              </span>
              <span>
                {Object.values(work.checklist).filter(Boolean).length}/3 actions
              </span>
            </div>
            {work.coach_advice && (
              <p className="work-coach">{work.coach_advice}</p>
            )}
            {!compactResponse && (
              <section
                className="learning-brief"
                aria-label="This week's learning brief"
              >
                <div className="learning-brief-title">
                  <span>THIS WEEK’S BUILD</span>
                  <strong>{week.minutes} min</strong>
                </div>
                <p>{week.task}</p>
                <div className="learning-proof">
                  <Check size={15} />
                  <span>
                    <small>YOU’LL HAVE</small>
                    <strong>{week.success}</strong>
                  </span>
                </div>
              </section>
            )}
            <div className="workbench-actions">
              {work.actions.map((action, index) => (
                <label
                  className={work.checklist[action.id] ? "done" : ""}
                  key={action.id}
                >
                  <input
                    type="checkbox"
                    checked={!!work.checklist[action.id]}
                    disabled={busy || readOnly}
                    onChange={(event) =>
                      void save(
                        {
                          ...work.checklist,
                          [action.id]: event.target.checked,
                        },
                        false,
                      )
                    }
                  />
                  <span className="work-action-number">
                    {work.checklist[action.id] ? (
                      <Check size={14} />
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </span>
                  <span>
                    <strong>{action.title}</strong>
                    {!compactResponse && <small>{action.detail}</small>}
                  </span>
                </label>
              ))}
            </div>
            {work.resource && showSource && (
              <div className="work-resource">
                <span className="public-eyebrow">
                  START WITH THIS SOURCE · {work.resource.provider}
                </span>
                <a
                  className="text-link"
                  href={work.resource.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {work.resource.title}
                  <ArrowUpRight size={14} />
                </a>
                {work.resource.sample_exercise && (
                  <p className="work-resource-exercise">
                    <strong>Try this:</strong> {work.resource.sample_exercise}
                  </p>
                )}
                <ResourceDetails resource={work.resource} />
              </div>
            )}
            <div className="work-evidence idea-callout">
              <button
                type="button"
                className="idea-callout-bubble"
                aria-expanded={ideaExpanded}
                aria-controls={`learning-idea-${week.week}`}
                disabled={readOnly}
                onClick={() => setIdeaExpanded((expanded) => !expanded)}
              >
                <FileCheck2 size={15} />
                <span>
                  <strong>
                    {reflection.trim()
                      ? "Your learning note"
                      : "Add a learning note"}
                  </strong>
                  <small>
                    {reflection.trim()
                      ? reflection
                      : "Keep one useful idea in your own words."}
                  </small>
                </span>
                <span aria-hidden="true">{ideaExpanded ? "−" : "+"}</span>
              </button>
              {ideaExpanded && (
                <aside
                  className="idea-callout-panel"
                  id={`learning-idea-${week.week}`}
                  aria-label="Learning note editor"
                >
                  <label htmlFor={`learning-note-${week.week}`}>
                    <span className="scratch-label">ONE IDEA TO KEEP</span>
                    <textarea
                      id={`learning-note-${week.week}`}
                      maxLength={1000}
                      autoFocus
                      value={reflection}
                      onChange={(event) => setReflection(event.target.value)}
                      placeholder="Write one idea you can explain in your own words…"
                    />
                  </label>
                  <small>
                    Saved notes stay private. They are shared with AI only if
                    you explicitly ask for a level review.
                  </small>
                  <div className="scratchboard-footer">
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => setIdeaExpanded(false)}
                    >
                      Collapse note
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => void save()}
                    >
                      {busy ? (
                        <LoaderCircle size={14} className="spin" />
                      ) : (
                        <FileCheck2 size={14} />
                      )}
                      Save note
                    </button>
                  </div>
                </aside>
              )}
              {message && (
                <p className="work-save-status" role="status">
                  {message}
                </p>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}
type Evidence = {
  week: number;
  checklist: Record<string, boolean>;
  evidence_url: string;
  reflection: string;
  learning_note?: string;
  practice_example?: string;
  open_question?: string;
  updated_at: string;
};
export function EvidencePortfolio({ state }: { state: State | null }) {
  const [records, setRecords] = useState<Evidence[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    api<Evidence[]>("/me/portfolio")
      .then((data) => {
        if (active) setRecords(data);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [state]);
  const complete = Object.values(state?.progress || {}).filter(
    (p) => p.status === "done",
  ).length;
  return (
    <section className="card evidence-portfolio">
      <div className="portfolio-heading">
        <span className="flow-orbit-icon">
          <FileCheck2 size={23} />
        </span>
        <div>
          <span className="public-eyebrow">YOUR WORK, TAKING SHAPE</span>
          <h2>My saved work</h2>
        </div>
        <strong>
          {complete}/4<span>weeks complete</span>
        </strong>
      </div>
      {loading ? (
        <p role="status">Loading saved work…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : records.length ? (
        <div className="portfolio-grid">
          {records.map((record) =>
            (() => {
              const note = record.learning_note || record.reflection;
              const practice = record.practice_example || "";
              const question = record.open_question || "";
              return (
                <article className="portfolio-board-card" key={record.week}>
                  <div className="portfolio-board-top">
                    <span className="public-eyebrow">
                      BOARD NOTE · WEEK {record.week}
                    </span>
                    <span className="portfolio-action-count">
                      {Object.values(record.checklist).filter(Boolean).length}/3
                      steps
                    </span>
                  </div>
                  <h3>
                    {state?.plan?.weeks.find((w) => w.week === record.week)
                      ?.title || "Practice evidence"}
                  </h3>
                  {note || practice || question ? (
                    <div className="portfolio-board-notes">
                      {note && (
                        <div className="portfolio-note idea-note">
                          <small>THE IDEA</small>
                          <p>{note}</p>
                        </div>
                      )}
                      {practice && (
                        <div className="portfolio-note example-note">
                          <small>MY EXAMPLE</small>
                          <p>{practice}</p>
                        </div>
                      )}
                      {question && (
                        <div className="portfolio-note question-note">
                          <small>TO REVISIT</small>
                          <p>{question}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="portfolio-empty-note">
                      Add a learning note, example or question from this week’s
                      workspace to make your progress visible.
                    </p>
                  )}
                  <div className="portfolio-board-footer">
                    <small>
                      Saved{" "}
                      {new Date(record.updated_at).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric" },
                      )}{" "}
                      · learner-recorded
                    </small>
                    {record.evidence_url && (
                      <a
                        className="text-link"
                        href={record.evidence_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open my work
                        <ArrowUpRight size={14} />
                      </a>
                    )}
                  </div>
                </article>
              );
            })(),
          )}
        </div>
      ) : (
        <p>
          No saved work yet. Add a link or reflection from your weekly
          workspace.
        </p>
      )}
      <a className="text-link" href="/cv">
        Use my experience in a CV review ↗
      </a>
    </section>
  );
}
