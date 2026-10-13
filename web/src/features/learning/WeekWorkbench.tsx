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
  updated_at?: string;
};
export default function WeekWorkbench({
  week,
  planId,
  status,
}: {
  week: Week;
  planId?: string | null;
  status?: string;
}) {
  const [work, setWork] = useState<Work | null>(null),
    [link, setLink] = useState(""),
    [reflection, setReflection] = useState(""),
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
          setLink(data.evidence_url);
          setReflection(data.reflection);
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
    if (!work || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await api<Work>(`/weeks/${week.week}/work`, {
        method: "PUT",
        body: JSON.stringify({
          checklist,
          evidence_url: includeEvidence ? link : work.evidence_url,
          reflection: includeEvidence ? reflection : work.reflection,
        }),
      });
      setWork(saved);
      setMessage(includeEvidence ? "Your evidence is saved." : "Action saved.");
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
            <div className="workbench-actions">
              {work.actions.map((action, index) => (
                <label
                  className={work.checklist[action.id] ? "done" : ""}
                  key={action.id}
                >
                  <input
                    type="checkbox"
                    checked={!!work.checklist[action.id]}
                    disabled={busy}
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
                    <small>{action.detail}</small>
                  </span>
                </label>
              ))}
            </div>
            {work.resource && (
              <div className="work-resource">
                <a
                  className="text-link"
                  href={work.resource.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {work.resource.title}
                  <ArrowUpRight size={14} />
                </a>
                <ResourceDetails resource={work.resource} />
              </div>
            )}
            <details className="work-evidence">
              <summary>
                <FileCheck2 size={16} />
                Keep evidence of your work
              </summary>
              <p>
                A project link or a short note helps you show what you actually
                did.
              </p>
              <label>
                Project or document link <span>(optional)</span>
                <input
                  type="url"
                  maxLength={1000}
                  value={link}
                  onChange={(event) => setLink(event.target.value)}
                  placeholder="https://…"
                />
              </label>
              <label>
                What did you build or learn?
                <textarea
                  maxLength={2000}
                  value={reflection}
                  onChange={(event) => setReflection(event.target.value)}
                  placeholder="What I tried, what worked, and what I need to practise next…"
                />
              </label>
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
                Save evidence
              </button>
              <small>
                Private notes and project links are excluded from AI requests.
                Saving a checklist does not mark the week complete.
              </small>
            </details>
            {message && (
              <p className="work-save-status" role="status">
                {message}
              </p>
            )}
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
          {records.map((record) => (
            <article key={record.week}>
              <span className="public-eyebrow">WEEK {record.week}</span>
              <h3>
                {state?.plan?.weeks.find((w) => w.week === record.week)
                  ?.title || "Practice evidence"}
              </h3>
              <p>
                {Object.values(record.checklist).filter(Boolean).length}/3
                actions recorded · Self-reported
              </p>
              {record.reflection && (
                <p className="portfolio-reflection">{record.reflection}</p>
              )}
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
            </article>
          ))}
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
