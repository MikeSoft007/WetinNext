import { isDirectSource } from "../../shared/sourceLinks";
import ReadinessCheck from "../progress/ReadinessCheck";
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
  Bookmark,
} from "lucide-react";
import { api } from "../../shared/api";
import type { State } from "../../shared/types";
import type { LearningPick } from "../learning/ContinueLearning";
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
  required_skills?: string[];
  open_status?: string;
  deadline?: string | null;
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
  paid_resources?: Source[];
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
type Job = {
  draft_orientation?: string;
  source_count?: number;
  source_preview?: { url: string; title: string }[];
  status: string;
  stage: string;
  result?: Guide;
  error?: string;
};
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
  const [trainingRoutes, setTrainingRoutes] = useState<Place[]>([]);
  useEffect(() => {
    let active = true;
    setTrainingRoutes([]);
    if (state?.profile.goal)
      api<Place[]>(
        `/training-routes?goal=${encodeURIComponent(state.profile.goal)}&market=${encodeURIComponent(market)}`,
      )
        .then((items) => {
          if (active && Array.isArray(items)) setTrainingRoutes(items);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [state?.profile.goal, market]);
  const previousMarket = useRef(market);
  const [picks, setPicks] = useState<LearningPick[]>([]),
    [pickBusy, setPickBusy] = useState("");
  const [cvSkills, setCvSkills] = useState<string[] | null>(null),
    [cvSkillError, setCvSkillError] = useState("");
  function domain(url: string) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "Original source";
    }
  }
  function sourceKey(value: string) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return null;
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      const path = url.pathname.replace(/\/+$/, "") || "/";
      return `${host}${path}`;
    } catch {
      return null;
    }
  }
  function citation(url: string) {
    const key = sourceKey(url);
    if (!key) return null;
    const index =
      guide?.sources.findIndex((source) => sourceKey(source.url) === key) ?? -1;
    return index >= 0 ? index + 1 : null;
  }

  const goal = state?.profile.goal || "";
  const storageKey = `wetinnext-research:${market}:${goal}`;
  const [showImages, setShowImages] = useState(false);
  useEffect(() => {
    const syncView = () => {
      const view = new URLSearchParams(location.search).get("view");
      if (
        view === "plan" ||
        view === "learn" ||
        view === "nearby" ||
        view === "assess"
      )
        setTab(view);
    };
    window.addEventListener("popstate", syncView);
    return () => window.removeEventListener("popstate", syncView);
  }, []);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(1);
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
        : new URLSearchParams(location.search).get("view") === "assess"
          ? "assess"
          : new URLSearchParams(location.search).get("view") === "nearby"
            ? "nearby"
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
    let active = true;
    setCvSkills(null);
    setCvSkillError("");
    if (!goal) {
      setCvSkills([]);
      return () => {
        active = false;
      };
    }
    api<{ skills?: string[] }[]>("/me/cv-reviews")
      .then((reviews) => {
        if (!Array.isArray(reviews))
          throw new Error("CV skill review data was not returned.");
        if (active)
          setCvSkills(
            reviews.flatMap((review) =>
              Array.isArray(review.skills) ? review.skills : [],
            ),
          );
      })
      .catch((e) => {
        if (active) {
          setCvSkillError((e as Error).message);
          setCvSkills([]);
        }
      });
    return () => {
      active = false;
    };
  }, [goal]);
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
  useEffect(() => {
    let active = true;
    setPicks([]);
    if (goal)
      api<LearningPick[]>(
        `/me/learning-picks?market=${encodeURIComponent(market)}`,
      )
        .then((data) => {
          if (active && Array.isArray(data)) setPicks(data);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [goal, market]);
  async function savePick(source: Source) {
    setPickBusy(source.id);
    setError("");
    try {
      const pick = await api<LearningPick>("/me/learning-picks", {
        method: "POST",
        body: JSON.stringify({ research_id: jobId, resource_id: source.id }),
      });
      setPicks((items) => [
        pick,
        ...items.filter((item) => item.id !== pick.id),
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPickBusy("");
    }
  }
  const matches = (item: unknown) =>
    !query.trim() ||
    JSON.stringify(item).toLowerCase().includes(query.trim().toLowerCase());
  const busy =
    starting || job?.status === "queued" || job?.status === "running";
  const guide = job?.result;
  const verifiedResources =
    guide?.resources.filter(
      (resource) =>
        isDirectSource(resource.url) && citation(resource.url) !== null,
    ) ?? [];
  const researchedPlaces =
    guide?.places.filter(
      (place) => isDirectSource(place.url) && citation(place.url) !== null,
    ) ?? [];
  const verifiedPlaces = Array.from(
    new Map(
      [
        ...researchedPlaces,
        ...trainingRoutes.filter((place) => isDirectSource(place.url)),
      ].map((place) => [place.url, place]),
    ).values(),
  );
  const verifiedOpenings =
    guide?.opportunities.filter(
      (opening) =>
        isDirectSource(opening.url) &&
        citation(opening.url) !== null &&
        opening.open_status === "current_open" &&
        (!opening.deadline ||
          new Date(`${opening.deadline}T23:59:59Z`).getTime() >= Date.now()),
    ) ?? [];
  const matchingResources = verifiedResources.filter(matches);
  const matchingPlaces = verifiedPlaces.filter(matches);
  const matchingOpenings = verifiedOpenings.filter(matches);
  function skillKey(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9+#.]+/g, " ")
      .trim();
  }
  const backgroundSignals = [
    state?.profile.background || "",
    ...(cvSkills ?? []),
  ]
    .map(skillKey)
    .filter(Boolean);
  const completedStudySkills = new Set(
    state?.plan?.research_id === jobId
      ? (guide?.weeks
          .filter(
            (week) => state.progress[String(week.week)]?.status === "done",
          )
          .map(
            (week) =>
              guide.resources.find(
                (resource) => resource.id === week.resource_id,
              )?.skill,
          )
          .map((skill) => skillKey(skill || ""))
          .filter(Boolean) ?? [])
      : [],
  );
  function openingFit(opening: Opening) {
    const required = [
      ...new Map(
        (opening.required_skills ?? [])
          .filter((skill) => skillKey(skill))
          .map((skill) => [skillKey(skill), skill]),
      ).values(),
    ];
    const evidenced = required.filter((skill) => {
      const key = skillKey(skill);
      return (
        backgroundSignals.some((signal) => signal.includes(key)) ||
        completedStudySkills.has(key)
      );
    });
    const missing = required.filter((skill) => !evidenced.includes(skill));
    return {
      required,
      evidenced,
      missing,
      percent:
        required.length && cvSkills !== null
          ? Math.round((evidenced.length / required.length) * 100)
          : null,
    };
  }
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
          <span className="research-live-label">
            <span />
            Live research
          </span>
          <h3>{job?.stage || "Starting your research"}</h3>
          {!!job?.source_count && (
            <>
              <p>{job.source_count} source pages found · checking relevance</p>
              <div className="source-chips">
                {job.source_preview?.map((source) => (
                  <a
                    href={source.url}
                    key={source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <BookOpen size={12} />
                    {domain(source.url)}
                    <ArrowUpRight size={12} />
                  </a>
                ))}
              </div>
            </>
          )}
          {job?.draft_orientation &&
            ["running", "queued"].includes(job.status) && (
              <section className="research-draft" aria-live="polite">
                <span className="public-eyebrow">
                  YOUR GUIDE IS TAKING SHAPE · DRAFT
                </span>
                <p>{job.draft_orientation}</p>
                <small>
                  Sources and recommendations are still being checked.
                </small>
              </section>
            )}
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
        <div className="research-response">
          <div className="guide-provenance">
            <span>
              <Check size={13} />
              Guide ready
            </span>
            <span>{guide.sources.length} linked sources</span>
            <span>
              Updated {new Date(guide.researched_at).toLocaleDateString()}
            </span>
          </div>
          <div className="source-chips">
            {Array.from(
              new Map(
                guide.sources.map((source) => [domain(source.url), source]),
              ).values(),
            )
              .slice(0, 4)
              .map((source) => (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  key={source.url}
                >
                  {domain(source.url)}
                  <ArrowUpRight size={12} />
                </a>
              ))}
          </div>
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
                <strong>{verifiedResources.length}</strong>
                <small>Free learning picks</small>
              </span>
              <ArrowUpRight size={15} />
            </button>
            <button onClick={() => setTab("learn")}>
              <GraduationCap size={23} />
              <span>
                <strong>{verifiedPlaces.length}</strong>
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
          {state?.plan?.research_id !== jobId && (
            <div className="research-start-plan">
              <span>Ready to turn this guide into weekly action?</span>
              <button
                className="primary"
                disabled={saving}
                onClick={() => {
                  setTab("plan");
                  if (state?.plan) setConfirm(true);
                  else void adopt();
                }}
              >
                Start this learning plan <ArrowRight size={15} />
              </button>
            </div>
          )}
          {state?.plan?.research_id === jobId && (
            <button
              className="primary"
              onClick={() => navigateApp("/app/progress?view=plan")}
            >
              Continue & extend your plan <ArrowRight size={15} />
            </button>
          )}
          <nav className="research-tabs" aria-label="Guide sections">
            {[
              [
                "learn",
                `Learn & schools · ${verifiedResources.length + verifiedPlaces.length}`,
              ],
              ["nearby", `Opportunities · ${verifiedOpenings.length}`],
              ["plan", "Your four weeks"],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={tab === id}
                onClick={() => {
                  setTab(id);
                  navigateApp(`/app/discover?view=${id}`, {
                    preserveScroll: true,
                  });
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "learn" && (
            <div className="research-learning">
              {(guide.paid_resources ?? [])
                .filter(
                  (source) => isDirectSource(source.url) && matches(source),
                )
                .map((source) => (
                  <article className="paid-learning-row" key={source.id}>
                    <div>
                      <span className="response-cost-tag">Paid</span>
                      <span className="eyebrow">
                        {source.provider} · {source.format}
                      </span>
                      <h3>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.title} <ArrowUpRight size={15} />
                        </a>
                      </h3>
                      <p>{source.why_it_fits}</p>
                      <small>{source.access_note}</small>
                    </div>
                  </article>
                ))}

              {matchingResources.map((source, index) => (
                <article key={source.id}>
                  <span className="research-number">
                    <BookOpen size={23} strokeWidth={1.4} />
                    <small>{String(index + 1).padStart(2, "0")}</small>
                  </span>
                  <div>
                    <span className="response-cost-tag">Free</span>
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
                    <div className="resource-action-row">
                      <a
                        className="source-citation"
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {citation(source.url)
                          ? `[${citation(source.url)}] `
                          : ""}
                        {domain(source.url)}
                        <ArrowUpRight size={12} />
                      </a>
                      <button
                        className="text-link"
                        disabled={
                          pickBusy === source.id ||
                          picks.some((pick) => pick.url === source.url)
                        }
                        onClick={() => void savePick(source)}
                      >
                        {picks.some((pick) => pick.url === source.url) ? (
                          <>
                            <Check size={14} />
                            Saved to Progress
                          </>
                        ) : (
                          <>
                            <Bookmark size={14} />
                            Save for later
                          </>
                        )}
                      </button>
                    </div>
                    <details className="resource-access">
                      <summary>Access & format</summary>
                      <small>{source.access_note}</small>
                    </details>
                  </div>
                </article>
              ))}
              {verifiedResources.length > 0 &&
                matchingResources.length === 0 && (
                  <p role="status">
                    No learning picks match this search. Clear or change the
                    Discover search to see all {verifiedResources.length}{" "}
                    verified picks.
                  </p>
                )}
            </div>
          )}
          {tab === "learn" && (
            <div className="research-nearby">
              <header>
                <h3>
                  Explore training for{" "}
                  {guide.location || "your chosen location"}
                </h3>
                <p>
                  {verifiedPlaces.length} training routes ·{" "}
                  {verifiedOpenings.length} confirmed openings. Training pages
                  do not guarantee a current intake; confirm dates with the
                  institution.
                </p>
              </header>
              {!verifiedPlaces.length && !verifiedOpenings.length && (
                <div className="research-empty" role="status">
                  <h3>Broaden the search for this goal</h3>
                  <p>
                    No sourced training route or current call was saved in this
                    guide. Search again to check related programmes across your
                    selected country.
                  </p>
                  <button
                    className="secondary"
                    disabled={
                      starting ||
                      job?.status === "running" ||
                      job?.status === "queued"
                    }
                    onClick={() => void research()}
                  >
                    Search schools & opportunities again
                  </button>
                </div>
              )}
              {matchingPlaces.length ? (
                <LocalCollection
                  items={matchingPlaces}
                  label="training places"
                  pageSize={6}
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
                          <a
                            className="source-citation"
                            href={place.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {citation(place.url)
                              ? `[${citation(place.url)}] `
                              : ""}
                            {domain(place.url)}
                            <ArrowUpRight size={12} />
                          </a>
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
              ) : verifiedPlaces.length > 0 ? (
                <p role="status">
                  No training places match this search. Clear or change the
                  Discover search to see all {verifiedPlaces.length} verified
                  institutions.
                </p>
              ) : (
                <p>
                  No directly sourced institution pages were verified for this
                  location. Try a nearby city or broader region; search-result
                  pages are not shown as institution links.
                </p>
              )}
              {verifiedPlaces.length > 0 && (
                <TrainingMap
                  location={guide.location || market}
                  places={verifiedPlaces}
                  market={market}
                />
              )}
            </div>
          )}
          {tab === "nearby" && (
            <div className="research-nearby">
              <h3 className="research-openings-title">
                Current opportunities to investigate
              </h3>
              <p className="opportunity-source-limit-note">
                Up to five direct-source calls per guide. We omit expired,
                undated or older-than-90-day calls without a future deadline,
                and search-result pages.
              </p>
              {matchingOpenings.length ? (
                <LocalCollection
                  items={matchingOpenings}
                  label="opportunities"
                  pageSize={6}
                  searchable={false}
                >
                  {(visible) =>
                    visible.map((opening) => (
                      <article
                        className="research-opening"
                        key={opening.url + opening.title}
                      >
                        {(() => {
                          const fit = openingFit(opening);
                          return (
                            <>
                              <div className="research-opening-heading">
                                <span className="eyebrow">
                                  {opening.type} · {opening.location}
                                </span>
                                <span
                                  className="opportunity-fit-tag"
                                  title="Evidence coverage is not a job-readiness prediction."
                                >
                                  {fit.percent === null
                                    ? cvSkills === null
                                      ? "Checking skill evidence…"
                                      : "Skills not listed"
                                    : `${fit.percent}% skill evidence`}
                                </span>
                              </div>
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
                                {opening.deadline_note} ·{" "}
                                {opening.availability_note}
                              </small>
                              <div
                                className="opportunity-fit-guidance"
                                role="note"
                              >
                                <strong>Recommended preparation</strong>
                                <p>
                                  {fit.required.length === 0
                                    ? "This listing does not state specific skills. Compare its eligibility and responsibilities with your background, then confirm details with the provider."
                                    : fit.missing.length
                                      ? `Practise ${fit.missing.join(", ")} in a small project and add honest evidence of your contribution to your CV.`
                                      : `Your available records mention the listed skills. Add a concrete example to your CV and confirm eligibility with the provider.`}
                                </p>
                                {fit.required.length > 0 && (
                                  <small>
                                    {fit.evidenced.length} of{" "}
                                    {fit.required.length} skills named by the
                                    listing appear in your profile, CV skill
                                    mentions or completed guide practice. This
                                    is evidence coverage, not a readiness or
                                    hiring prediction.
                                  </small>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </article>
                    ))
                  }
                </LocalCollection>
              ) : verifiedOpenings.length > 0 ? (
                <p role="status">
                  No opportunities match this search. Clear or change the
                  Discover search to see all {verifiedOpenings.length} verified
                  opportunities.
                </p>
              ) : (
                <p>
                  No directly sourced current openings were verified. Check
                  official institution and employer pages for new calls.
                </p>
              )}
              {cvSkillError && (
                <p className="opportunity-evidence-notice" role="status">
                  CV skill mentions could not be loaded, so the percentages
                  exclude CV evidence and use only your profile and completed
                  guide practice.
                </p>
              )}
            </div>
          )}
          {tab === "assess" && (
            <div className="research-exams">
              <div className="assessment-route-visual">
                <span>
                  <BookOpen size={23} />
                  <strong>Practise</strong>
                  <small>Find what to revisit</small>
                </span>
                <ArrowRight size={18} />
                <span>
                  <Check size={23} />
                  <strong>Keep evidence</strong>
                  <small>Show your work</small>
                </span>
                <ArrowRight size={18} />
                <span>
                  <GraduationCap size={25} />
                  <strong>Check eligibility</strong>
                  <small>Confirm formal requirements</small>
                </span>
              </div>
              <ReadinessCheck state={state} onUpdated={onSaved} />
              <details className="assessment-eligibility">
                <summary>Formal training & eligibility</summary>
                <p>{guide.qualification_route}</p>
                {verifiedPlaces.slice(0, 2).map((place) => (
                  <article key={place.url}>
                    <strong>{place.name}</strong>
                    <p>{place.entry_route}</p>
                    <a href={place.url} target="_blank" rel="noreferrer">
                      Confirm requirements with the institution
                      <ArrowUpRight size={14} />
                    </a>
                  </article>
                ))}
              </details>
              <h3>External assessments</h3>
              {guide.exams?.some(
                (exam) =>
                  isDirectSource(exam.url) && citation(exam.url) !== null,
              ) ? (
                guide.exams
                  .filter(
                    (exam) =>
                      isDirectSource(exam.url) &&
                      citation(exam.url) !== null &&
                      matches(exam),
                  )
                  .map((exam) => (
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
                  No directly sourced external assessment was verified for this
                  goal. Use the practice check above, then confirm formal
                  requirements with the institution or regulator.
                </p>
              )}
            </div>
          )}
          {tab === "plan" && (
            <div className="research-plan">
              <div className="roadmap-ribbon">
                {guide.weeks.map((week) => (
                  <a
                    key={week.week}
                    href={`#guide-week-${week.week}`}
                    onClick={() => setExpandedWeek(week.week)}
                  >
                    <span>{week.week}</span>
                    <strong>{week.title}</strong>
                    <small>{week.minutes} min</small>
                  </a>
                ))}
              </div>
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
                    <li id={`guide-week-${week.week}`} key={week.week}>
                      <span>{String(week.week).padStart(2, "0")}</span>
                      <div>
                        <small>
                          WEEK {week.week} · {week.minutes} MIN
                        </small>
                        <details
                          className="research-week-detail"
                          open={expandedWeek === week.week}
                        >
                          <summary
                            onClick={(event) => {
                              event.preventDefault();
                              setExpandedWeek((current) =>
                                current === week.week ? null : week.week,
                              );
                            }}
                          >
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
                    {visible.map((source) => (
                      <li key={source.url}>
                        <span>
                          {String(
                            guide.sources.findIndex(
                              (item) => item.url === source.url,
                            ) + 1,
                          ).padStart(2, "0")}
                        </span>
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
