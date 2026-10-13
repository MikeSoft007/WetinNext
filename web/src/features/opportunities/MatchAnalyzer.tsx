import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  ArrowUpRight,
  ShieldCheck,
  Target,
  Clock3,
} from "lucide-react";
import { api } from "../../shared/api";
import { ApplicationEditor, type Journal } from "./OpportunityJournal";
import type { Assessment, Opportunity } from "../../shared/types";
export function MatchAnalyzer({
  opportunity,
  assessment,
  loading,
  onExplore,
}: {
  opportunity?: Opportunity;
  assessment: Assessment | null;
  loading: boolean;
  onExplore: () => void;
}) {
  const [journal, setJournal] = useState<Journal | null>(null);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setJournal(null);
    setSaveError("");
    if (opportunity)
      api<Journal>(`/preparation/${opportunity.id}`)
        .then((data) => {
          if (active) setJournal(data);
        })
        .catch((e) => {
          if (active) setSaveError(e.message);
        });
    return () => {
      active = false;
    };
  }, [opportunity?.id]);
  async function tick(action: string, completed: boolean) {
    if (!opportunity || !journal) return;
    const previous = journal;
    setJournal({
      ...journal,
      checklist: { ...journal.checklist, [action]: completed },
    });
    setSaving(true);
    setSaveError("");
    try {
      setJournal(
        await api<Journal>(`/preparation/${opportunity.id}`, {
          method: "PUT",
          body: JSON.stringify({ action, completed }),
        }),
      );
    } catch (e) {
      setJournal(previous);
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="card analyzer">
      <div className="card-heading">
        <span className="icon-box">
          <Target size={19} />
        </span>
        <div>
          <h2>Opportunity match & skill gaps</h2>
          <p>Your learning, connected to what’s next.</p>
        </div>
        <span className="live-dot" />
      </div>
      {!opportunity ? (
        <div className="empty-state">
          <Target size={30} />
          <h3>No opportunities in this view</h3>
          <p>Try a different search or market. Your pathway is still here.</p>
          <button className="secondary" onClick={onExplore}>
            Explore opportunities
          </button>
        </div>
      ) : (
        <>
          <div className="selected-job">
            <div className="company-logo">
              {opportunity.country === "Rwanda"
                ? "RW"
                : opportunity.country === "Nigeria"
                  ? "NG"
                  : "GL"}
            </div>
            <div>
              <span className="eyebrow">
                SELECTED OPPORTUNITY ·{" "}
                {opportunity.sample ? "PRACTICE" : "PUBLIC LISTING"}
              </span>
              <h3>{opportunity.title}</h3>
              <p>
                {opportunity.organisation} · {opportunity.country}
              </p>
            </div>
            <ArrowUpRight size={18} />
          </div>
          <div className="match-disclaimer">
            {opportunity.sample
              ? "Practice listing · no live employer or application deadline"
              : `Verify requirements on the original listing. Deadline: ${opportunity.deadline || "Check source"}`}
          </div>
          {loading ? (
            <p role="status" className="loading-inline">
              Reviewing your evidence…
            </p>
          ) : assessment ? (
            <>
              <p className="match-disclaimer">
                {assessment.engine === "OpenAI"
                  ? "OpenAI guidance"
                  : assessment.fallback_reason || "Basic evidence checks"}
              </p>
              <div className="analysis-section">
                <h4>
                  <CheckCircle2 size={15} />
                  Your evidence signals
                </h4>
                {assessment.supported.length ? (
                  assessment.supported.map((s) => (
                    <div className="requirement supported" key={s.requirement}>
                      <CheckCircle2 size={16} />
                      <div>
                        <strong>{s.requirement}</strong>
                        <p>{s.evidence}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="subtle">
                    Complete a task or add relevant profile information to
                    establish a starting point. No skills are assumed.
                  </p>
                )}
              </div>
              <div className="analysis-section">
                <h4 className="amber-text">
                  <AlertCircle size={15} />
                  Skill gaps & uncertainties
                </h4>
                <div className="gap-tags">
                  {assessment.gaps.map((g) => (
                    <span title={g.reason} key={g.requirement}>
                      <Circle size={10} />
                      {g.requirement}
                    </span>
                  ))}
                </div>
                <p className="subtle">{assessment.gap}</p>
              </div>
              <div className="analysis-section">
                <h4>
                  <Clock3 size={15} />
                  Your next preparation steps
                </h4>
                <p className="subtle">
                  {assessment.minutes
                    ? `Suggested effort: ${assessment.minutes} min. `
                    : ""}
                  {assessment.deadline_notice} Preparation progress saves to
                  your account.
                </p>
                <div className="action-checklist">
                  {assessment.actions.map((action) => {
                    const key = opportunity.id + action;
                    return (
                      <label key={key}>
                        <input
                          type="checkbox"
                          checked={!!journal?.checklist[action]}
                          disabled={saving || !journal}
                          onChange={(e) => void tick(action, e.target.checked)}
                        />
                        <span>{action}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {!!assessment.learning_resources?.length && (
                <div className="analysis-section">
                  <h4>Learn for this opportunity</h4>
                  {assessment.learning_resources.map(({ resource, reason }) => (
                    <p key={resource.id}>
                      <a href={resource.url} target="_blank" rel="noreferrer">
                        {resource.title} ↗
                      </a>
                      <br />
                      <span className="subtle">{reason}</span>
                    </p>
                  ))}
                </div>
              )}
              <details className="honest-guide">
                <summary>
                  <ShieldCheck size={16} />
                  Present your experience honestly
                </summary>
                <ul>
                  {assessment.honest_guide.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </details>
            </>
          ) : (
            <p className="subtle">
              Preparation review unavailable. Refresh this page to retry.
            </p>
          )}
          {saveError && (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}
          {journal && (
            <details className="application-fit">
              <summary>Track this opportunity</summary>
              <ApplicationEditor
                record={journal}
                onSaved={() => {
                  api<Journal>(`/preparation/${opportunity.id}`)
                    .then(setJournal)
                    .catch((e) => setSaveError(e.message));
                }}
              />
            </details>
          )}
          {opportunity.source_changed_at && (
            <p className="match-disclaimer">
              Source requirements updated{" "}
              {new Date(opportunity.source_changed_at).toLocaleDateString()}.
              Recheck your saved preparation against the latest listing.
            </p>
          )}
          {!opportunity.sample && (
            <p className="match-disclaimer">
              {opportunity.last_check_result || "Availability not verified"} ·
              Last checked:{" "}
              {opportunity.last_checked_at
                ? new Date(opportunity.last_checked_at).toLocaleString()
                : "Not yet checked"}
              .{" "}
              {opportunity.source && (
                <span>Source: {opportunity.source}. </span>
              )}
              {opportunity.url && (
                <a href={opportunity.url} target="_blank" rel="noreferrer">
                  View original listing ↗
                </a>
              )}
            </p>
          )}
          <button className="inline-link analyzer-footer" onClick={onExplore}>
            Back to Discover <ArrowUpRight size={15} />
          </button>
        </>
      )}
    </section>
  );
}
