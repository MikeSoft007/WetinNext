import { navigateApp } from "../../app/useSectionRoute";
import { LocalCollection } from "../../shared/ui/Collection";
import TrainingMap from "./TrainingMap";
import { useEffect, useState, useRef } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Compass,
  GraduationCap,
  MapPin,
  Search,
} from "lucide-react";
import { api } from "../../shared/api";
import type { State } from "../../shared/types";
import ProcessingProgress from "../../shared/ui/ProcessingProgress";
type Source = {
  id: string;
  title: string;
  provider: string;
  url: string;
  format: string;
  access_note: string;
  why_it_fits: string;
  skill: string;
};
type Place = {
  name: string;
  kind: string;
  location: string;
  url: string;
  entry_route: string;
  cost_note: string;
  availability_note: string;
  accreditation_note: string;
};
type Opening = {
  title: string;
  provider: string;
  location: string;
  url: string;
  type: string;
  eligibility: string;
  deadline_note: string;
  availability_note: string;
};
type Exam = {
  title: string;
  provider: string;
  url: string;
  cost_type: string;
  cost_note: string;
  prerequisites: string;
  purpose: string;
};
type Guide = {
  exams?: Exam[];
  title: string;
  orientation: string;
  qualification_route: string;
  goal: string;
  location: string;
  resources: Source[];
  places: Place[];
  opportunities: Opening[];
  weeks: {
    week: number;
    title: string;
    task: string;
    success: string;
    resource_id: string;
    minutes: number;
  }[];
  sources: { title: string; url: string }[];
  next_question: string;
  researched_at: string;
  notice: string;
};
type Job = { status: string; stage: string; result?: Guide; error?: string };
export default function GoalResearch({
  state,
  market,
  onSaved,
  onSetup,
  compact = false,
  refreshToken = 0,
  query = "",
}: {
  state: State | null;
  market: string;
  onSaved: () => Promise<void>;
  onSetup: () => void;
  compact?: boolean;
  refreshToken?: number;
  query?: string;
}) {
  const previousMarket = useRef(market);
  const goal = state?.profile.goal || "";
  const storageKey = `wetinnext-research:${market}:${goal}`;
  const [showImages, setShowImages] = useState(false);
  const [education, setEducation] = useState("not_shared"),
    [budget, setBudget] = useState("free_only");
  const [city, setCity] = useState(""),
    [jobId, setJobId] = useState<string | null>(null),
    [job, setJob] = useState<Job | null>(null),
    [starting, setStarting] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [tab, setTab] = useState(
      new URLSearchParams(location.search).get("view") === "plan"
        ? "plan"
        : "learn",
    ),
    [confirm, setConfirm] = useState(false),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    const scopeChanged = previousMarket.current !== market;
    previousMarket.current = market;
    let active = true;
    setJob(null);
    setError("");
    setSaved(false);
    setJobId(null);
    if (goal) {
      api<{ id: string | null } & Job>(
        `/me/research?market=${encodeURIComponent(market)}`,
      )
        .then((data) => {
          if (active && data.id) {
            sessionStorage.setItem(storageKey, data.id);
            setJob(data);
            setJobId(data.id);
          } else if (active) {
            sessionStorage.removeItem(storageKey);
            setCity("");
            if (
              (scopeChanged ||
                new URLSearchParams(location.search).get("view") === "plan") &&
              !compact
            ) {
              setStarting(true);
              api<{ id: string }>("/research", {
                method: "POST",
                body: JSON.stringify({ market, city: "" }),
              })
                .then((next) => {
                  if (active) {
                    setJob({
                      status: "queued",
                      stage: "Researching your selected market",
                    });
                    setJobId(next.id);
                    sessionStorage.setItem(storageKey, next.id);
                  }
                })
                .catch((e) => {
                  if (active) setError((e as Error).message);
                })
                .finally(() => {
                  if (active) setStarting(false);
                });
            }
          }
        })
        .catch(() => {
          if (active) setJobId(sessionStorage.getItem(storageKey));
        });
    }
    return () => {
      active = false;
    };
  }, [storageKey, goal, market, refreshToken]);
  useEffect(() => {
    if (!jobId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await api<Job>(`/research/${jobId}`);
        if (!active) return;
        setJob(next);
        if (next.status === "running" || next.status === "queued")
          timer = setTimeout(poll, 2000);
      } catch (e) {
        if (active) {
          sessionStorage.removeItem(storageKey);
          setJobId(null);
          setJob(null);
          setError(
            "We couldn’t reopen the guide. Use Research my goal to recover or refresh it.",
          );
        }
      }
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [jobId, storageKey]);
  const matches = (item: unknown) =>
    !query.trim() ||
    JSON.stringify(item).toLowerCase().includes(query.trim().toLowerCase());
  const busy =
    starting || job?.status === "queued" || job?.status === "running";
  const guide = job?.result;
  async function research() {
    setStarting(true);
    setError("");
    setSaved(false);
    setConfirm(false);
    try {
      const next = await api<{ id: string }>("/research", {
        method: "POST",
        body: JSON.stringify({
          city,
          market,
          education,
          budget,
          refresh: true,
        }),
      });
      sessionStorage.setItem(storageKey, next.id);
      setJob({ status: "queued", stage: "Preparing your research" });
      setJobId(next.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }
  async function adopt() {
    setSaving(true);
    setError("");
    try {
      await api("/me/research-plan", {
        method: "POST",
        body: JSON.stringify({ research_id: jobId }),
      });
      await onSaved();
      setSaved(true);
      setConfirm(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  if (compact && state?.plan?.research_id)
    return (
      <section className="research-saved-strip">
        <div>
          <h2>{state.plan.title}</h2>
        </div>
        <a
          className="text-link"
          href="/app/discover"
          onClick={(e) => {
            e.preventDefault();
            navigateApp("/app/discover");
          }}
        >
          Open guide
          <ArrowUpRight size={15} />
        </a>
      </section>
    );
  if (compact && guide)
    return (
      <section className="research-saved-strip">
        <div>
          <h2>{guide.title}</h2>
          <p>{guide.resources.length} learning picks · Four-week roadmap</p>
        </div>
        <a
          className="text-link"
          href="/app/discover?view=plan"
          onClick={(e) => {
            e.preventDefault();
            navigateApp("/app/discover?view=plan");
          }}
        >
          Open guide
          <ArrowRight size={15} />
        </a>
      </section>
    );
  if (compact) return null;
  return (
    <section className="research-studio" aria-label="Live goal research">
      <div className="research-intro">
        <h2>
          {guide
            ? guide.title
            : goal
              ? "Find learning and training"
              : "Choose a learning goal"}
        </h2>
        <p>
          {guide
            ? guide.orientation
            : goal
              ? "Find learning resources, nearby training and a practical starting plan."
              : "Set a goal to find relevant learning resources and next steps."}
        </p>
        {(goal || guide) && (
          <div className="research-context">
            <span>
              <MapPin size={13} />
              {guide?.location || market}
            </span>
            <span>{state?.profile.hours || 3} hrs / week</span>
            <span>
              {state?.profile.low_data !== false
                ? "Text-first"
                : "Flexible data"}
            </span>
          </div>
        )}
      </div>
      {!guide && !busy && (
        <div className="research-start">
          {goal ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void research();
              }}
            >
              <label>
                <MapPin size={17} />
                <span className="sr-only">City or region</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  maxLength={100}
                  placeholder="Your city or region (optional)"
                  disabled={starting}
                />
              </label>
              <button className="primary" disabled={starting}>
                <Search size={16} />
                Research my goal
              </button>
            </form>
          ) : (
            <button className="primary" onClick={onSetup}>
              Choose my goal
              <ArrowRight size={16} />
            </button>
          )}
          {goal && (
            <details className="research-refine">
              <summary>Refine my options</summary>
              <div>
                <label>
                  Highest education
                  <select
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                  >
                    <option value="not_shared">Prefer not to say</option>
                    <option value="secondary">Secondary school</option>
                    <option value="diploma">Diploma</option>
                    <option value="degree">Degree or higher</option>
                  </select>
                </label>
                <label>
                  Training budget
                  <select
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  >
                    <option value="free_only">
                      Free learning / scholarships
                    </option>
                    <option value="affordable">Affordable training</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </label>
              </div>
            </details>
          )}
          <p>
            Live search · Linked sources · Access and cost shown · Location
            optional
          </p>
        </div>
      )}
      {busy && (
        <div className="research-loading" role="status">
          <h3>{job?.stage || "Starting your research"}</h3>
          <ProcessingProgress
            label="Researching your goal"
            detail="This can take a minute or two. You can leave this page and return."
          />
        </div>
      )}
      {guide && query && (
        <p role="status">
          Showing matches for “{query}” within this goal’s guide. Clear search
          to see all results.
        </p>
      )}
      {(error || job?.error) && (
        <p className="auth-error" role="alert">
          {error || job?.error}
        </p>
      )}
      {guide && (
        <div className="research-response" aria-live="polite">
          <div className="research-visual-control">
            {state?.profile.low_data !== false && (
              <button
                className="text-link"
                onClick={() => setShowImages(!showImages)}
              >
                {showImages ? "Hide images" : "Show learning image · ~128 KB"}
              </button>
            )}
          </div>
          {(state?.profile.low_data === false || showImages) && (
            <figure className="guide-image">
              <img
                src="/images/learning-together.jpg"
                alt="Illustration of African learners studying together in a library"
                width="1000"
                height="667"
                loading="lazy"
              />
              <figcaption>
                AI-generated learning illustration · not a photograph of a
                listed institution
              </figcaption>
            </figure>
          )}
          <details className="research-route">
            <summary>Qualifications & training route</summary>
            <p>{guide.qualification_route}</p>
          </details>
          <div className="research-atlas" aria-label="Your guide at a glance">
            <button onClick={() => setTab("learn")}>
              <BookOpen size={22} />
              <span>
                <strong>{guide.resources.length}</strong>
                <small>Free learning picks</small>
              </span>
              <ArrowUpRight size={15} />
            </button>
            <button onClick={() => setTab("nearby")}>
              <GraduationCap size={23} />
              <span>
                <strong>{guide.places.length}</strong>
                <small>Training places to explore</small>
              </span>
              <ArrowUpRight size={15} />
            </button>
            <button onClick={() => setTab("plan")}>
              <Compass size={23} />
              <span>
                <strong>4 weeks</strong>
                <small>Your starting roadmap</small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          </div>
          <nav className="research-tabs" aria-label="Guide sections">
            {[
              ["learn", `Learn · ${guide.resources.length}`],
              [
                "nearby",
                `Schools & opportunities · ${guide.places.length + guide.opportunities.length}`,
              ],
              ["plan", "Your four weeks"],
              ["assess", "Assess your next step"],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "learn" && (
            <div className="research-learning">
              {guide.resources.filter(matches).map((source, index) => (
                <article key={source.id}>
                  <span className="research-number">
                    <BookOpen size={23} strokeWidth={1.4} />
                    <small>{String(index + 1).padStart(2, "0")}</small>
                  </span>
                  <div>
                    <span className="eyebrow">
                      {source.provider} · {source.format}
                    </span>
                    <h3>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.title}
                        <ArrowUpRight size={17} />
                      </a>
                    </h3>
                    <p>{source.why_it_fits}</p>
                    <small>{source.access_note}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
          {tab === "nearby" && (
            <div className="research-nearby">
              <header>
                <h3>
                  Explore training near{" "}
                  {guide.location || "your chosen location"}
                </h3>
                <p>Check current intake dates with each institution.</p>
              </header>
              {guide.places.length ? (
                <LocalCollection
                  items={guide.places.filter(matches)}
                  label="training places"
                  pageSize={2}
                  searchable={false}
                >
                  {(visible) =>
                    visible.map((place) => (
                      <article
                        className="research-place"
                        key={place.url + place.name}
                      >
                        <span className="place-icon institution-tile">
                          <GraduationCap size={29} strokeWidth={1.2} />
                          <small>TRAINING</small>
                        </span>
                        <div>
                          <span className="eyebrow">
                            {place.kind} · {place.location}
                          </span>
                          <h3>{place.name}</h3>
                          <p>{place.entry_route}</p>
                          <div className="research-place-links">
                            <a
                              href={place.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Institution website
                              <ArrowUpRight size={14} />
                            </a>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + " " + place.location)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MapPin size={14} />
                              Find on map
                            </a>
                          </div>
                          <details>
                            <summary>Costs, admissions & recognition</summary>
                            <p>{place.cost_note}</p>
                            <p>{place.availability_note}</p>
                            <p>{place.accreditation_note}</p>
                          </details>
                        </div>
                      </article>
                    ))
                  }
                </LocalCollection>
              ) : (
                <p>
                  No sufficiently sourced local training institutions found. Try
                  a nearby city or broader region.
                </p>
              )}
              <TrainingMap
                location={guide.location || market}
                places={guide.places}
                market={market}
              />
              <h3 className="research-openings-title">
                Current opportunities to investigate
              </h3>
              {guide.opportunities.length ? (
                <LocalCollection
                  items={guide.opportunities.filter(matches)}
                  label="opportunities"
                  pageSize={3}
                  searchable={false}
                >
                  {(visible) =>
                    visible.map((opening) => (
                      <article
                        className="research-opening"
                        key={opening.url + opening.title}
                      >
                        <span className="eyebrow">
                          {opening.type} · {opening.location}
                        </span>
                        <h3>
                          <a
                            href={opening.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {opening.title}
                            <ArrowUpRight size={15} />
                          </a>
                        </h3>
                        <p>
                          {opening.provider} · {opening.eligibility}
                        </p>
                        <small>
                          {opening.deadline_note} · {opening.availability_note}
                        </small>
                      </article>
                    ))
                  }
                </LocalCollection>
              ) : (
                <p>
                  No current openings found. Check the institutions for upcoming
                  intakes.
                </p>
              )}
            </div>
          )}
          {tab === "assess" && (
            <div className="research-exams">
              <h3>Choose the right kind of assessment</h3>
              <p>Find learning gaps, then check the formal requirements.</p>
              <a
                className="text-link"
                href="/app/progress?view=practice#practice-check"
                onClick={(e) => {
                  e.preventDefault();
                  navigateApp("/app/progress?view=practice#practice-check");
                }}
              >
                Open my in-app practice & evidence check ↗
              </a>
              {guide.exams?.length ? (
                guide.exams.filter(matches).map((exam) => (
                  <article key={exam.url}>
                    <span className="eyebrow">
                      {exam.provider} · {exam.cost_type}
                    </span>
                    <h3>
                      <a href={exam.url} target="_blank" rel="noreferrer">
                        {exam.title} ↗
                      </a>
                    </h3>
                    <p>{exam.cost_note}</p>
                    <details>
                      <summary>Purpose & entry requirements</summary>
                      <p>{exam.purpose}</p>
                      <small>{exam.prerequisites}</small>
                    </details>
                  </article>
                ))
              ) : (
                <p>
                  No sourced exam options in this saved guide. Refine this
                  search to look for current free practice, paid exams or
                  flexible options.
                </p>
              )}
            </div>
          )}
          {tab === "plan" && (
            <div className="research-plan">
              <div className="research-plan-heading">
                <div>
                  <span className="eyebrow">
                    A STARTING POINT, NOT A FINISH LINE
                  </span>
                  <h3>Four weeks. Something to show for each one.</h3>
                </div>
                <button
                  className="primary"
                  disabled={
                    saving || saved || state?.plan?.research_id === jobId
                  }
                  onClick={() => {
                    if (state?.plan) setConfirm(true);
                    else void adopt();
                  }}
                >
                  {saved || state?.plan?.research_id === jobId ? (
                    <>
                      <Check size={15} />
                      Plan saved
                    </>
                  ) : (
                    <>
                      Use this plan
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
              {confirm && (
                <div className="research-replace" role="status">
                  <p>
                    Replace your active sprint? Previous work is retained; your
                    new weekly checklist starts fresh.
                  </p>
                  <button
                    className="secondary"
                    disabled={saving}
                    onClick={() => void adopt()}
                  >
                    {saving ? "Saving…" : "Replace active sprint"}
                  </button>
                  <button
                    className="text-link"
                    disabled={saving}
                    onClick={() => setConfirm(false)}
                  >
                    Keep current sprint
                  </button>
                </div>
              )}
              <ol>
                {guide.weeks.map((week) => {
                  const source = guide.resources.find(
                    (r) => r.id === week.resource_id,
                  );
                  return (
                    <li key={week.week}>
                      <span>{String(week.week).padStart(2, "0")}</span>
                      <div>
                        <small>
                          WEEK {week.week} · {week.minutes} MIN
                        </small>
                        <details
                          className="research-week-detail"
                          open={week.week === 1}
                        >
                          <summary>
                            <h3>{week.title}</h3>
                          </summary>
                          <p>{week.task}</p>
                          <p className="research-evidence">
                            <Check size={14} />
                            {week.success}
                          </p>
                          {source && (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {source.title}
                              <ArrowUpRight size={14} />
                            </a>
                          )}
                        </details>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {(saved || state?.plan?.research_id === jobId) && (
                <a
                  className="text-link"
                  href="/app"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateApp("/app");
                  }}
                >
                  Open my weekly workspace
                  <ArrowRight size={15} />
                </a>
              )}
            </div>
          )}
          <footer className="research-footer">
            <button
              className="text-link"
              onClick={() => {
                sessionStorage.removeItem(storageKey);
                setJobId(null);
                setJob(null);
                setConfirm(false);
                setSaved(false);
              }}
            >
              Refine this search
            </button>
            <span>
              Researched {new Date(guide.researched_at).toLocaleDateString()} ·{" "}
              {guide.sources.length} sources
            </span>
            <details>
              <summary>Sources & important details</summary>
              <p>{guide.notice}</p>
              <LocalCollection
                items={guide.sources}
                label="research sources"
                pageSize={6}
                searchable={false}
              >
                {(visible) => (
                  <ul>
                    {visible.map((source, index) => (
                      <li key={source.url}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          <strong>{source.title}</strong>{" "}
                          <small>{new URL(source.url).hostname}</small>
                        </a>
                        <ArrowUpRight size={14} />
                      </li>
                    ))}
                  </ul>
                )}
              </LocalCollection>
            </details>
            {guide.next_question && (
              <p className="research-question">
                To refine your next search: {guide.next_question}
              </p>
            )}
          </footer>
        </div>
      )}
    </section>
  );
}
