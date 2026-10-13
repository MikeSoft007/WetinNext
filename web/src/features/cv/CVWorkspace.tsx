import ProcessingProgress from "../../shared/ui/ProcessingProgress";
import ResourceCard from "../discovery/ResourceCard";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  UploadCloud,
  ArrowLeft,
  ArrowRight,
  FileText,
  Check,
  Trash2,
  LoaderCircle,
  Compass,
  RotateCcw,
} from "lucide-react";
import { api } from "../../shared/api";
import type { Opportunity, State, Resource } from "../../shared/types";
import { CatalogCollection } from "../../shared/ui/Collection";
type Review = {
  suggested_resources?: Resource[];
  id: string;
  filename: string;
  created_at: string;
  goal: string;
  opportunity_title: string | null;
  skills: string[];
  sections: Record<string, boolean>;
  supported: string[];
  gaps: string[];
  actions: { priority: string; title: string; detail: string }[];
  notice: string;
  extracted_preview: string;
  word_count: number;
};
export default function CVWorkspace() {
  const [reviews, setReviews] = useState<Review[]>([]),
    [selected, setSelected] = useState<Review | null>(null),
    [opps, setOpps] = useState<Opportunity[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState(""),
    [step, setStep] = useState(1),
    [file, setFile] = useState<File | null>(null),
    [goal, setGoal] = useState(""),
    [opportunity, setOpportunity] = useState(""),
    [phase, setPhase] = useState<"idle" | "reading" | "reviewing">("idle"),
    [dragging, setDragging] = useState(false);
  const busy = phase !== "idle";
  const results = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [r, s] = await Promise.all([
          api<Review[]>("/me/cv-reviews"),
          api<State>("/me"),
        ]);
        if (active) {
          setReviews(r);
          setSelected(
            r.find((review) => review.goal === s.profile.goal) || null,
          );
          setGoal(s.profile.goal || "");
          if (s.profile.goal) {
            void api<{ opportunities: { opportunity: Opportunity }[] }>(
              `/recommendations?country=${encodeURIComponent(sessionStorage.getItem("wetinnext-market") || s.profile.country || "Nigeria")}`,
            )
              .then((data) => {
                if (active)
                  setOpps(
                    (data?.opportunities || []).map((item) => item.opportunity),
                  );
              })
              .catch(() => {
                if (active) setOpps([]);
              });
          }
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (step === 3) results.current?.focus();
  }, [step, selected?.id]);
  function chooseFile(next: File | null) {
    setError("");
    if (!next) return;
    if (
      !/\.(pdf|docx|txt)$/i.test(next.name) ||
      !next.size ||
      next.size > 5 * 1024 * 1024
    ) {
      setError("Choose a PDF, DOCX or TXT file up to 5 MB.");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setFile(next);
  }
  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    if (goal.trim().length < 5) {
      setError("Describe your target role in at least five characters.");
      return;
    }
    setError("");
    setPhase("reading");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      setPhase("reviewing");
      const result = await api<Review>("/me/cv-reviews", {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          content_base64: btoa(binary),
          goal: goal.trim(),
          opportunity_id: opportunity,
        }),
      });
      setReviews((previous) => [result, ...previous]);
      setSelected(result);
      setStep(3);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPhase("idle");
    }
  }
  async function remove(review: Review) {
    if (
      !window.confirm("Delete this saved CV review and its extracted preview?")
    )
      return;
    try {
      await api(`/me/cv-reviews/${review.id}`, { method: "DELETE" });
      setReviews((previous) => previous.filter((r) => r.id !== review.id));
      if (selected?.id === review.id) {
        const next = reviews.find((r) => r.id !== review.id) || null;
        setSelected(next);
        if (!next) setStep(1);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function startAgain() {
    setFile(null);
    setStep(1);
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  }
  return (
    <div className="management-page cv-studio">
      <header className="management-header">
        <a className="public-brand" href="/">
          WetinNext<span>.</span>
        </a>
        <a href="/app">
          <ArrowLeft size={15} />
          Back to my workspace
        </a>
      </header>
      <main className="management-main">
        <div className="studio-heading">
          <div>
            <h1>CV review</h1>
            <p>
              {goal
                ? `Get practical feedback for ${goal}.`
                : "See the experience and skills your CV already shows."}
            </p>
          </div>
        </div>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div className="cv-layout">
          <aside className="cv-input-column">
            <section className="management-card cv-input-card">
              {step === 1 && (
                <form className="flow-panel" onSubmit={upload} aria-busy={busy}>
                  <label
                    className={`cv-dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      chooseFile(event.dataTransfer.files[0] || null);
                    }}
                  >
                    <input
                      ref={fileInput}
                      className="sr-only"
                      aria-label="CV document"
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(event) =>
                        chooseFile(event.target.files?.[0] || null)
                      }
                    />
                    <span className="flow-orbit-icon">
                      {file ? (
                        <FileText size={25} />
                      ) : (
                        <UploadCloud size={25} />
                      )}
                    </span>
                    <strong>{file ? file.name : "Choose your CV"}</strong>
                    <span>
                      {file
                        ? `${(file.size / 1024).toFixed(0)} KB · Ready to review`
                        : "Drop a file here or browse your device"}
                    </span>
                    <small>PDF, DOCX or TXT · up to 5 MB</small>
                  </label>
                  <fieldset disabled={busy}>
                    <label>
                      Your target role or goal
                      <input
                        required
                        minLength={5}
                        maxLength={500}
                        value={goal}
                        onChange={(event) => setGoal(event.target.value)}
                        placeholder="e.g. Data analyst internship"
                      />
                    </label>
                    <details className="cv-compare">
                      <summary>Compare with an opportunity (optional)</summary>
                      <label>
                        <span className="sr-only">Select an opportunity</span>
                        <select
                          value={opportunity}
                          onChange={(event) =>
                            setOpportunity(event.target.value)
                          }
                        >
                          <option value="">General CV preparation</option>
                          {opps.map((o) => (
                            <option value={o.id} key={o.id}>
                              {o.title} · {o.country}
                              {o.sample ? " (practice)" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    </details>
                  </fieldset>
                  <p className="privacy-note">
                    Your original file is not retained or sent to OpenAI. A
                    review and extracted preview are saved.
                  </p>
                  <button
                    className="primary wide"
                    disabled={
                      !file || goal.trim().length < 5 || busy || loading
                    }
                  >
                    {busy ? (
                      <>
                        <LoaderCircle size={16} className="spin" />
                        {phase === "reading"
                          ? "Reading your file…"
                          : "Checking your CV…"}
                      </>
                    ) : (
                      <>
                        Find my next steps
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              )}
              {step === 3 && selected && (
                <div className="flow-panel">
                  <div className="cv-file-summary">
                    <Check size={18} />
                    <span>{selected.filename}</span>
                  </div>
                  <p>
                    Your latest saved review helps personalise discovery. Your
                    profile controls your overall career goal.
                  </p>
                  <a className="public-button peach wide" href="/app/discover">
                    Explore my matches
                    <ArrowRight size={16} />
                  </a>
                  <button className="text-link" onClick={startAgain}>
                    <RotateCcw size={14} />
                    Review another CV
                  </button>
                </div>
              )}
            </section>
            <details className="management-card cv-saved">
              <summary>Saved reviews</summary>
              <label className="collection-search">
                <span className="sr-only">Search CV reviews</span>
                <input
                  type="search"
                  maxLength={100}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a review…"
                />
              </label>
              <CatalogCollection<Review>
                endpoint="/me/cv-reviews"
                kind="resources"
                query={query}
                refreshToken={reviews}
              >
                {(visible) =>
                  visible.map((r) => (
                    <div className="review-row" key={r.id}>
                      <button
                        disabled={busy}
                        onClick={() => {
                          setSelected(r);
                          setStep(3);
                          setError("");
                        }}
                        aria-pressed={selected?.id === r.id}
                      >
                        <FileText size={15} />
                        {r.filename}
                        <small>
                          {new Date(r.created_at).toLocaleDateString()}
                        </small>
                      </button>
                      <button
                        disabled={busy}
                        title="Delete review"
                        aria-label={`Delete review ${r.filename}`}
                        onClick={() => remove(r)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                }
              </CatalogCollection>
            </details>
          </aside>
          {(busy || (step === 3 && selected)) && (
            <section
              className="management-card cv-results"
              aria-live="polite"
              aria-busy={busy}
            >
              {busy ? (
                <div className="cv-processing">
                  <span className="processing-orbit">
                    <FileText size={32} />
                  </span>
                  <h2>
                    {phase === "reading"
                      ? "Reading your document"
                      : "Reviewing your CV"}
                  </h2>
                  <ProcessingProgress
                    label={
                      phase === "reading"
                        ? "Reading your CV"
                        : "Evaluating your CV"
                    }
                    detail={
                      phase === "reading"
                        ? "Preparing your document for review."
                        : "Checking skills and evidence, then saving your recommended actions."
                    }
                  />
                  <span className="subtle">
                    Your file stays out of OpenAI requests.
                  </span>
                </div>
              ) : step === 3 && selected ? (
                <div className="flow-panel">
                  <div className="cv-result-heading">
                    <div>
                      <h2 ref={results} tabIndex={-1}>
                        Your review
                      </h2>
                      <p>
                        {selected.goal}
                        {selected.opportunity_title
                          ? ` · ${selected.opportunity_title}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="cv-evidence-summary">
                    <div>
                      <strong>{selected.skills.length}</strong>
                      <span>skill mentions</span>
                    </div>
                    <div>
                      <strong>
                        {
                          Object.values(selected.sections).filter(Boolean)
                            .length
                        }
                        /4
                      </strong>
                      <span>sections found</span>
                    </div>
                    <div>
                      <strong>{selected.actions.length}</strong>
                      <span>suggested actions</span>
                    </div>
                  </div>
                  <p className="privacy-note">
                    Text mentions are signals, not verified proficiency or a
                    hiring score.
                  </p>
                  <h3>What your CV brings</h3>
                  <div className="cv-skills">
                    {selected.skills.length ? (
                      selected.skills.map((skill) => (
                        <span key={skill}>{skill}</span>
                      ))
                    ) : (
                      <p>
                        No tracked skill terms detected. Check the extracted
                        text below.
                      </p>
                    )}
                  </div>
                  <h3>Your next three moves</h3>
                  <div className="cv-action-list">
                    {selected.actions.slice(0, 3).map((action, index) => (
                      <article className="cv-action" key={action.title}>
                        <span className="action-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <span className="action-priority">
                            {action.priority}
                          </span>
                          <h4>{action.title}</h4>
                          <p>{action.detail}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                  {selected.actions.length > 3 && (
                    <details>
                      <summary>
                        {selected.actions.length - 3} more suggested actions
                      </summary>
                      {selected.actions.slice(3).map((action, index) => (
                        <article className="cv-action" key={index}>
                          <div>
                            <h4>{action.title}</h4>
                            <p>{action.detail}</p>
                          </div>
                        </article>
                      ))}
                    </details>
                  )}
                  {!!selected.suggested_resources?.length && (
                    <>
                      <h3>Resources for your next move</h3>
                      <div className="cv-resource-grid">
                        {selected.suggested_resources.map((resource) => (
                          <ResourceCard resource={resource} key={resource.id} />
                        ))}
                      </div>
                    </>
                  )}
                  <details className="cv-details">
                    <summary>Structure & opportunity evidence</summary>
                    <div className="cv-sections">
                      {Object.entries(selected.sections).map(
                        ([name, found]) => (
                          <span key={name}>
                            {found ? <Check size={14} /> : <span>○</span>}
                            {name}: {found ? "detected" : "not detected"}
                          </span>
                        ),
                      )}
                    </div>
                    {selected.opportunity_title && (
                      <>
                        <p>
                          Mentioned:{" "}
                          {selected.supported.join(", ") ||
                            "No tracked terms detected"}
                        </p>
                        <p>
                          Clarify:{" "}
                          {selected.gaps.join(", ") ||
                            "Check eligibility and demonstrate your contribution."}
                        </p>
                      </>
                    )}
                  </details>
                  <details className="cv-details">
                    <summary>Check extracted text & review limits</summary>
                    <p className="privacy-note">{selected.notice}</p>
                    <pre>{selected.extracted_preview}</pre>
                  </details>
                  <a className="text-link" href="/app/discover">
                    <Compass size={16} />
                    Turn this into a next step
                    <ArrowRight size={14} />
                  </a>
                </div>
              ) : null}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
