import GoalPrompt from "../goals/GoalPrompt";
import ResourceBank from "../discovery/ResourceBank";
import CareerJourney from "../progress/CareerJourney";
import CareerBank from "../discovery/CareerBank";
import WeekReviewModal from "../progress/WeekReviewModal";
import LearningBranches from "../goals/LearningBranches";
import CVWorkspace from "../cv/CVWorkspace";
import GoalLaunchpad from "../learning/GoalLaunchpad";
import ContinueLearning from "../learning/ContinueLearning";
import GoalPreparation from "../progress/GoalPreparation";
import GoalSwitcher from "../goals/GoalSwitcher";
import SkillTracker from "../progress/SkillTracker";
import ReadinessCheck from "../progress/ReadinessCheck";
import GoalResearch from "../discovery/GoalResearch";
import ProgressOverview from "../progress/ProgressOverview";
import LinkedInBridge from "../discovery/LinkedInBridge";
import { EvidencePortfolio } from "../learning/WeekWorkbench";
import React, { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Sprout,
  Route,
  Compass,
  Settings,
  GraduationCap,
  CheckCircle2,
  X,
  Target,
  LoaderCircle,
  Search,
  Send,
  Flame,
  SlidersHorizontal,
  History,
  FileText,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { api } from "../../shared/api";
import SignOutButton from "../../shared/ui/SignOutButton";
import OpportunityJournal from "../opportunities/OpportunityJournal";
import {
  useSectionRoute,
  learnerRoutes,
  navigateApp,
} from "../../app/useSectionRoute";

import { OnboardingModal } from "../goals/OnboardingModal";
import { HistoryPanel } from "../progress/HistoryPanel";
import type {
  Profile,
  State,
  Resource,
  Opportunity,
  Assessment,
  HistoryEntry,
} from "../../shared/types";
import { PathwayTracker } from "../goals/PathwayTracker";
import CareerPathTree from "../goals/CareerPathTree";
import { MatchAnalyzer } from "../opportunities/MatchAnalyzer";
const initial: Profile = {
  name: "",
  learner_type: "student",
  country: "Nigeria",
  goal: "",
  hours: 3,
  device: "laptop",
  background: "",
  low_data: true,
};
const nav = [
  { label: "Discover", icon: Compass },
  { label: "Progress", icon: History },
  { label: "Review", icon: FileText },
];
export default function LearnerWorkspace({
  onSignOut,
}: {
  onSignOut: () => Promise<void>;
}) {
  const [libraryView, setLibraryView] = useState<"career" | "resource" | null>(
    null,
  );
  const [reviewWeek, setReviewWeek] = useState<number | null>(null);
  const [researchVersion, setResearchVersion] = useState(0);
  const [treeRefreshToken, setTreeRefreshToken] = useState(0);
  const [state, setState] = useState<State | null>(null),
    [resources, setResources] = useState<Resource[]>([]),
    [opps, setOpps] = useState<Opportunity[]>([]),
    [history, setHistory] = useState<HistoryEntry[]>([]);
  const [page, setPage] = useSectionRoute(learnerRoutes);
  useEffect(() => setReviewWeek(null), [state?.goal_id, page]);
  useEffect(() => {
    if (
      page === "Progress" &&
      new URLSearchParams(location.search).get("view") === "plan" &&
      state?.plan
    )
      setReviewWeek(
        state.plan.weeks.find(
          (week) => state.progress[String(week.week)]?.status !== "done",
        )?.week ||
          state.plan.weeks[0]?.week ||
          null,
      );
  }, [page, location.search, state?.plan?.id]);
  function progressView() {
    const view = new URLSearchParams(location.search).get("view") || "overview";
    return ["overview", "skills", "practice", "portfolio", "history"].includes(
      view,
    )
      ? view
      : "overview";
  }
  const [progressTab, setProgressTab] = useState(progressView);
  useEffect(() => {
    const sync = () => {
      if (location.pathname === "/app/progress") setProgressTab(progressView());
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const [market, setMarket] = useState(
      () => sessionStorage.getItem("wetinnext-market") || "Nigeria",
    ),
    [search, setSearch] = useState(""),
    [setup, setSetup] = useState(false),
    [profile, setProfile] = useState<Profile>(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [selectedId, setSelectedId] = useState(
      new URLSearchParams(location.search).get("opportunity") || "",
    ),
    [selectedOpportunity, setSelectedOpportunity] =
      useState<Opportunity | null>(null),
    [assessment, setAssessment] = useState<Assessment | null>(null),
    [matching, setMatching] = useState(false),
    [deleteOpen, setDeleteOpen] = useState(false),
    [adjustOpen, setAdjustOpen] = useState(false),
    [hours, setHours] = useState(3),
    [device, setDevice] = useState("laptop"),
    [lowData, setLowData] = useState(true),
    [ready, setReady] = useState(false);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !modalOpen &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (document.activeElement as HTMLElement)?.tagName,
        )
      ) {
        event.preventDefault();
        document
          .querySelector<HTMLInputElement>(
            '[aria-label="Search resources and opportunities"]',
          )
          ?.focus();
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [setup, deleteOpen, adjustOpen]);
  useEffect(() => {
    const restore = () => {
      const id = new URLSearchParams(location.search).get("opportunity");
      if (id) setSelectedId(id);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const modalOpen = setup || deleteOpen || adjustOpen;
  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    const backgrounds = Array.from(
      document.querySelectorAll<HTMLElement>(".workspace,.topbar,.sidebar"),
    );
    backgrounds.forEach((el) => {
      el.inert = true;
    });
    const focusables = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
        ) ?? [],
      ).filter((node) => node.getClientRects().length > 0);
    focusables()[0]?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setSetup(false);
        setDeleteOpen(false);
        setAdjustOpen(false);
      }
      if (event.key === "Tab") {
        const items = focusables(),
          first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      backgrounds.forEach((el) => {
        el.inert = false;
      });
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [modalOpen, busy]);
  async function refresh() {
    const [s, h] = await Promise.all([
      api<State>("/me"),
      api<HistoryEntry[]>("/check-ins"),
    ]);
    setState(s);
    setHistory(h);
  }
  useEffect(() => {
    (async () => {
      try {
        const health = await api<{
          telegram_bot_url: string | null;
          demo_mode: boolean;
        }>("/health");
        if (health.demo_mode) await api("/demo/session", { method: "POST" });
        const [s, r, h] = await Promise.all([
          api<State>("/me"),
          api<Resource[]>("/resources"),
          api<HistoryEntry[]>("/check-ins"),
        ]);
        setState(s);
        setProfile({ ...initial, ...s.profile } as Profile);
        setResources(r);
        setHistory(h);
        setMarket(
          sessionStorage.getItem("wetinnext-market") ||
            (s.profile.country === "Rwanda" ? "Rwanda" : "Nigeria"),
        );
        setReady(true);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);
  useEffect(() => {
    if (!ready) return;
    sessionStorage.setItem("wetinnext-market", market);
    setOpps([]);
    let cancelled = false;
    const timer = setTimeout(() => {
      api<Opportunity[]>(`/opportunities?country=${encodeURIComponent(market)}`)
        .then((o) => {
          if (!cancelled) {
            setOpps(o);
            setSelectedId(
              (id) =>
                new URLSearchParams(location.search).get("opportunity") ||
                (o.some((x) => x.id === id) ? id : (o[0]?.id ?? "")),
            );
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [market, ready]);
  function reviewOpportunity(id: string) {
    setSelectedId(id);
    setPage("Opportunity fit");
    window.history.replaceState(
      {},
      "",
      `/app/match?opportunity=${encodeURIComponent(id)}`,
    );
  }
  const selected =
    selectedOpportunity?.id === selectedId
      ? selectedOpportunity
      : opps.find((o) => o.id === selectedId);
  useEffect(() => {
    if (!selectedId || !ready || page !== "Opportunity fit") {
      setAssessment(null);
      return;
    }
    let cancelled = false;
    setMatching(true);
    setAssessment(null);
    Promise.all([
      api<Assessment>(`/opportunities/${selectedId}/assessment`),
      api<Opportunity>(`/opportunities/${selectedId}`),
    ])
      .then(([a, o]) => {
        if (!cancelled) {
          setAssessment(a);
          setSelectedOpportunity(o);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setMatching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, state?.progress, ready, page]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 6500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const goalResult = await api<{ restored?: boolean }>(
        state?.profile.goal ? "/me/goal" : "/me/profile",
        {
          method: "PUT",
          body: JSON.stringify({
            ...profile,
            name: state?.profile.name || profile.name || "Learner",
          }),
        },
      );
      await refresh();
      setSetup(false);
      setPage("Discover");
      const researchMarket =
        !state?.profile.goal && ["Nigeria", "Rwanda"].includes(profile.country)
          ? profile.country
          : market;
      setMarket(researchMarket);
      if (goalResult.restored) {
        setResearchVersion((value) => value + 1);
        setToast("Your saved goal and progress are restored.");
        return;
      }
      try {
        await api("/research", {
          method: "POST",
          body: JSON.stringify({
            market: researchMarket,
            city: "",
            refresh: true,
          }),
        });
        setResearchVersion((value) => value + 1);
        setToast(
          "Your goal is saved. We’re researching your learning guide now.",
        );
      } catch (researchError) {
        setToast(`Your goal is saved. ${(researchError as Error).message}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function checkIn(weekNumber: number, status: string) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ advice: string }>(
        `/weeks/${weekNumber}/check-in`,
        { method: "POST", body: JSON.stringify({ status, note: "" }) },
      );
      await refresh();
      setToast(result.advice);
      setTreeRefreshToken((token) => token + 1);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  function openAdjust() {
    setHours(state?.profile.hours ?? 3);
    setDevice(state?.profile.device ?? "laptop");
    setLowData(state?.profile.low_data ?? true);
    setAdjustOpen(true);
  }
  async function adjust(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/me/profile", {
        method: "PATCH",
        body: JSON.stringify({ hours, device, low_data: lowData }),
      });
      await refresh();
      setAdjustOpen(false);
      setToast("Availability updated. Your completed work is preserved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const personalisedState = state?.needs_goal_research
    ? { ...state, plan: null }
    : state;
  const plan = personalisedState?.plan,
    completed = Object.values(state?.progress ?? {}).filter(
      (p) => p.status === "done",
    ).length,
    name = state?.profile.name?.split(" ")[0];
  const pageTitles: Record<string, string> = {
    Today: "Discover",
    Review: "Review your experience",
    Discover: "Discover",
    Progress: "Progress",
    "Opportunity fit": "Opportunity fit",
    Settings: "Settings",
  };
  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Discover");
          }}
        >
          <span className="brand-icon">
            <Sprout size={22} />
          </span>
          Wetin<span>Next</span>
          <span className="brand-dot">.</span>
        </a>
        <label className="location-select">
          <MapPin size={15} />
          <select
            aria-label="Search location"
            value={market}
            onChange={(event) => setMarket(event.target.value)}
          >
            <option value="Nigeria">Nigeria</option>
            <option value="Rwanda">Rwanda</option>
            <option value="Global">Global · online & international</option>
          </select>
        </label>
        <label className="quick-search">
          <Search size={17} />
          <input
            aria-label="Search resources and opportunities"
            placeholder="Search within your goal’s guide…"
            value={search}
            maxLength={100}
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value) setPage("Discover");
            }}
          />
          <kbd>/</kbd>
        </label>
        <div className="top-actions">
          <span
            className="telegram-roadmap"
            title="Future feature: phone-based check-ins and next steps via Telegram"
          >
            <Send size={15} />
            <span>Telegram · coming later</span>
          </span>
          <span
            className="streak"
            title="Consecutive calendar weeks with a check-in"
          >
            <Flame size={17} />
            <strong>{state?.metrics?.weekly_streak ?? 0}</strong>
            <span>week streak</span>
          </span>
          <button className="user-profile" onClick={() => setPage("Settings")}>
            <span className="avatar">{name?.[0]?.toUpperCase() ?? "Y"}</span>
            <span>
              <strong>{name ?? "Your space"}</strong>
              <small>
                {state?.profile.learner_type === "self-taught"
                  ? "Self-taught learner"
                  : "Learner"}
              </small>
            </span>
          </button>
        </div>
      </header>
      <aside className="sidebar">
        <div className="workspace-name">
          <span className="workspace-icon">
            <GraduationCap size={18} />
          </span>
          <div>
            <strong>My learning workspace</strong>
            <small>YOUR OWN WAY FORWARD</small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(({ label, icon: Icon }) => (
            <button
              aria-label={label}
              aria-current={page === label ? "page" : undefined}
              key={label}
              className={"nav-item " + (page === label ? "active" : "")}
              onClick={() => setPage(label)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {page === label && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="small-steps">
            <span>✳</span>
            <h3>Direction over pressure.</h3>
            <p>
              A realistic plan beats a perfect one. Keep taking your next step.
            </p>
            <div className="mini-track">
              <i style={{ width: `${completed * 25}%` }} />
            </div>
            <small>{completed} / 4 weeks complete</small>
          </div>
          <button
            aria-label="Preferences and profile"
            className={"nav-item " + (page === "Settings" ? "active" : "")}
            onClick={() => setPage("Settings")}
          >
            <Settings size={18} />
            <span>Preferences & profile</span>
          </button>
          <div className="demo-foot">
            <span /> Local demo workspace
          </div>
        </div>
      </aside>
      <main className="workspace">
        <div className="breadcrumb">
          Workspace <ChevronRight size={13} />
          {page}
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {state?.profile.goal && (
          <GoalSwitcher
            state={state}
            onAdd={() => {
              setProfile({
                ...initial,
                ...state?.profile,
                goal: "",
                career_track: "auto",
              } as Profile);
              setSetup(true);
            }}
            onSwitched={async () => {
              await refresh();
              setResearchVersion((value) => value + 1);
              setSelectedId("");
              setPage("Discover");
            }}
          />
        )}
        <section
          className={`page-heading page-heading--${page === "Opportunity fit" ? "opportunity" : page.toLowerCase()}`}
        >
          <h1>{pageTitles[page]}</h1>
          {page === "Discover" && plan && (
            <button
              className="secondary adjust-button"
              disabled={!ready}
              onClick={openAdjust}
            >
              <SlidersHorizontal size={15} />
              Adjust my plan
            </button>
          )}
        </section>
        {["Discover", "Progress", "Review"].includes(page) && (
          <p className="page-guidance">
            {page === "Discover"
              ? "Explore careers and resources, then turn your goal into a plan."
              : page === "Progress"
                ? "Continue your weekly work and build evidence for your next step."
                : "Compare your current experience with the skills your goal needs."}
          </p>
        )}
        {page === "Discover" && state?.profile.goal && (
          <p className="learner-context">
            {state.profile.hours ?? "—"} hrs / week
            <span aria-hidden="true">·</span>
            {state.profile.device === "phone" ? "Phone" : "Laptop"}
            <span aria-hidden="true">·</span>
            {state.profile.low_data === false ? "Flexible data" : "Text-first"}
            <span aria-hidden="true">·</span>
            {market}
          </p>
        )}
        {ready &&
          state?.profile.goal &&
          ["Discover", "Progress", "Review"].includes(page) && (
            <section
              className="learner-mission"
              aria-label="Your current goal and next action"
            >
              <div className="mission-symbol" aria-hidden="true">
                <svg viewBox="0 0 80 80" width="64" height="64" fill="none">
                  <path
                    d="M16 62V24h18v38M34 62V38h18v24M52 62V14h12v48"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M13 17l16-8 17 15 18-19"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <circle cx="64" cy="5" r="4" fill="currentColor" />
                </svg>
              </div>
              <div>
                <span className="public-eyebrow">
                  YOUR DIRECTION · {market}
                </span>
                <h2>{state.profile.goal}</h2>
                <p>
                  {plan
                    ? `${completed} of ${plan.weeks.length} weeks complete · ${plan.weeks.find((week) => state.progress[String(week.week)]?.status !== "done")?.title || "Your starter plan is complete. Grow another learning branch."}`
                    : "Start with a sourced guide. Build one useful skill at a time."}
                </p>
              </div>
              {page !== "Review" && (
                <button
                  className="primary"
                  onClick={() => {
                    if (page === "Progress" && plan)
                      setReviewWeek(
                        plan.weeks.find(
                          (week) =>
                            state.progress[String(week.week)]?.status !==
                            "done",
                        )?.week ||
                          plan.weeks[0]?.week ||
                          null,
                      );
                    else
                      navigateApp(
                        plan
                          ? "/app/progress?view=plan"
                          : "/app/discover?view=plan",
                      );
                  }}
                >
                  {plan
                    ? page === "Discover"
                      ? "View my progress"
                      : "Continue learning"
                    : "Build my starter plan"}
                  <ArrowRight size={15} />
                </button>
              )}
            </section>
          )}
        {!ready && !error ? (
          <div className="loading-inline">
            <LoaderCircle className="spin" size={20} />
            Loading your workspace…
          </div>
        ) : (
          <>
            {page === "Discover" && (
              <div className="discover-library-layout">
                <div className="discover-main">
                  <GoalPrompt
                    onGoal={(goal) => {
                      setProfile({
                        ...initial,
                        ...state?.profile,
                        goal,
                        career_track: "auto",
                      } as Profile);
                      setSetup(true);
                    }}
                  />
                  {state?.profile.goal && (
                    <GoalResearch
                      state={state}
                      market={market}
                      onSaved={refresh}
                      onSetup={() => setSetup(true)}
                      refreshToken={researchVersion}
                      query={search}
                    />
                  )}
                </div>
                <aside
                  className="discovery-library-rail"
                  aria-label="Career and resource libraries"
                >
                  <header>
                    <span className="public-eyebrow">
                      YOUR EXPLORATION LIBRARY
                    </span>
                    <h2>Explore further</h2>
                  </header>
                  <div className="library-rail-tabs">
                    <button
                      aria-pressed={libraryView === "career"}
                      onClick={() =>
                        setLibraryView(
                          libraryView === "career" ? null : "career",
                        )
                      }
                    >
                      Career bank
                    </button>
                    <button
                      aria-pressed={libraryView === "resource"}
                      onClick={() =>
                        setLibraryView(
                          libraryView === "resource" ? null : "resource",
                        )
                      }
                    >
                      Resource bank
                    </button>
                  </div>
                  {libraryView === "career" && (
                    <CareerBank
                      market={market}
                      state={state}
                      onChoose={(title) => {
                        setProfile({
                          ...initial,
                          ...state?.profile,
                          goal: `Become a ${title}`,
                          career_track: "auto",
                        } as Profile);
                        setSetup(true);
                      }}
                    />
                  )}
                  {libraryView === "resource" && (
                    <ResourceBank state={state} market={market} />
                  )}
                  <p className="privacy-note">
                    Browse, compare and choose a direction without replacing
                    your saved goal.
                  </p>
                </aside>
              </div>
            )}
            {page === "Discover" && state?.profile.goal && (
              <details className="catalogue-more">
                <summary>Explore LinkedIn for this goal</summary>
                <LinkedInBridge goal={state.profile.goal} market={market} />
              </details>
            )}
            {page === "Review" && (
              <CVWorkspace
                key={state?.goal_id || state?.profile.goal}
                embedded
                market={market}
              />
            )}
            {page === "Opportunity fit" && (
              <div className="matcher-layout">
                <section className="card matcher-intro">
                  <span className="icon-box">
                    <Target size={24} />
                  </span>
                  <h2>
                    From requirements
                    <br />
                    to your next action.
                  </h2>
                  <p>
                    Choose an opportunity to compare its requirements with your
                    profile and recorded learning activity.
                  </p>
                  <label>
                    Select an opportunity
                    <select
                      value={selectedId}
                      onChange={(e) => reviewOpportunity(e.target.value)}
                    >
                      {opps.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="notice">
                    This review is guidance, not a hiring prediction. Unknown
                    requirements remain unknown.
                  </div>
                </section>
                <MatchAnalyzer
                  key={selected?.id}
                  opportunity={selected}
                  assessment={assessment}
                  loading={matching}
                  onExplore={() => setPage("Discover")}
                />
              </div>
            )}
            {page === "Progress" && (
              <div className="progress-page">
                <nav
                  className="workspace-sections"
                  aria-label="Progress sections"
                >
                  {[
                    ["overview", "Overview"],
                    ["skills", "Skill evidence"],
                    ["practice", "Practice checks"],
                    ["portfolio", "Portfolio & applications"],
                    ["history", "Journey log"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      aria-pressed={progressTab === id}
                      onClick={() => navigateApp(`/app/progress?view=${id}`)}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
                <div hidden={progressTab !== "overview"}>
                  <ProgressOverview
                    state={personalisedState}
                    onStart={() => setSetup(true)}
                    onContinue={() =>
                      setReviewWeek(
                        plan?.weeks.find(
                          (week) =>
                            state?.progress[String(week.week)]?.status !==
                            "done",
                        )?.week ||
                          plan?.weeks[0]?.week ||
                          null,
                      )
                    }
                    onWeekClick={setReviewWeek}
                  />
                  {page === "Progress" && state?.profile.goal && (
                    <>
                      <ContinueLearning state={state} market={market} />
                      {plan && (
                        <details className="extend-learning">
                          <summary>Extend my learning</summary>
                          <LearningBranches
                            planId={plan.id || state.profile.goal || plan.title}
                            resources={plan.resources || []}
                          />
                        </details>
                      )}
                    </>
                  )}

                  {state?.profile.goal && (
                    <details className="sprint-overview">
                      <summary>Goals and reminders</summary>
                      <GoalPreparation state={state} onSwitch={refresh} />
                    </details>
                  )}
                </div>
                <div hidden={progressTab !== "skills"}>
                  {personalisedState?.plan ? (
                    <SkillTracker state={personalisedState} />
                  ) : (
                    <p>Build a plan in Discover to track its skills.</p>
                  )}
                </div>
                <div hidden={progressTab !== "practice"}>
                  <ReadinessCheck
                    state={personalisedState}
                    onUpdated={refresh}
                  />
                </div>
                <div hidden={progressTab !== "portfolio"}>
                  <EvidencePortfolio state={state} />
                  <OpportunityJournal
                    refreshToken={state}
                    onReview={(id) => {
                      setSelectedId(id);
                      setPage("Opportunity fit");
                      window.history.replaceState(
                        {},
                        "",
                        `/app/match?opportunity=${encodeURIComponent(id)}`,
                      );
                    }}
                  />
                </div>
                <div hidden={progressTab !== "history"}>
                  <CareerJourney state={state} />
                  <HistoryPanel
                    history={history}
                    country={state?.profile.country}
                    onPathway={() => setPage("Discover")}
                  />
                </div>
              </div>
            )}
            {page === "Settings" && (
              <section className="card settings-card">
                <h2>Your learning profile</h2>
                <button
                  className="text-link"
                  onClick={() => {
                    setProfile({
                      ...initial,
                      ...state?.profile,
                      career_track: "auto",
                    } as Profile);
                    setSetup(true);
                  }}
                >
                  Change my learning goal ↗
                </button>
                {plan ? (
                  <dl className="settings-profile">
                    <div>
                      <dt>Name</dt>
                      <dd>{state?.profile.name}</dd>
                    </div>
                    <div>
                      <dt>Goal</dt>
                      <dd>{state?.profile.goal}</dd>
                    </div>
                    <div>
                      <dt>Weekly time</dt>
                      <dd>{state?.profile.hours} hours</dd>
                    </div>
                    <div>
                      <dt>Device</dt>
                      <dd>{state?.profile.device}</dd>
                    </div>
                    <div>
                      <dt>Guidance mode</dt>
                      <dd>{plan.engine}</dd>
                    </div>
                  </dl>
                ) : (
                  <p>Create a pathway to add your profile.</p>
                )}
                <div className="notice">
                  Your profile and progress belong to your current session.
                  Telegram features depend on your workspace configuration.
                </div>
                {plan && (
                  <button className="secondary" onClick={openAdjust}>
                    Adjust availability <SlidersHorizontal size={15} />
                  </button>
                )}
                <button
                  className="danger-button"
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete my profile and progress
                </button>
              </section>
            )}
          </>
        )}
        <footer>
          <span>
            <Sprout size={14} /> Know where you are. Know wetin next.
          </span>
          <span>Built around real life · Nigeria & Rwanda</span>
          <SignOutButton onConfirm={onSignOut} />
        </footer>
      </main>
      {toast && (
        <div role="status" className="toast">
          <CheckCircle2 size={20} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {reviewWeek !== null &&
        personalisedState?.plan?.weeks.find(
          (week) => week.week === reviewWeek,
        ) && (
          <WeekReviewModal
            state={personalisedState}
            week={
              personalisedState.plan.weeks.find(
                (week) => week.week === reviewWeek,
              )!
            }
            onClose={() => setReviewWeek(null)}
            onComplete={(week) => checkIn(week, "done")}
            onSaved={refresh}
          />
        )}
      {setup && (
        <OnboardingModal
          hasProfile={!!state}
          profile={profile}
          setProfile={setProfile}
          busy={busy}
          error={error}
          onClose={() => setSetup(false)}
          onSubmit={saveProfile}
        />
      )}
      {deleteOpen && (
        <div className="modal-backdrop">
          <section
            className="modal small"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Start fresh?</h2>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <p>
              This deletes your profile, plan, progress, and saved practice
              opportunities from the local database.
            </p>
            <div className="checkin-actions">
              <button
                className="secondary"
                onClick={() => setDeleteOpen(false)}
              >
                Keep my progress
              </button>
              <button
                className="danger-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await api("/me", { method: "DELETE" });
                    const health = await api<{ demo_mode: boolean }>("/health");
                    if (health.demo_mode)
                      await api("/demo/session", { method: "POST" });
                    // Bootstrap the blank identity before dependent requests.
                    setState(await api<State>("/me"));
                    setHistory(await api<HistoryEntry[]>("/check-ins"));
                    setDeleteOpen(false);
                    setPage("Discover");
                    setToast("Your profile and progress have been deleted.");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Delete my data
              </button>
            </div>
          </section>
        </div>
      )}{" "}
      {adjustOpen && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="adjust-title"
          >
            <button
              className="close-modal"
              aria-label="Close adjustment"
              disabled={busy}
              onClick={() => setAdjustOpen(false)}
            >
              <X />
            </button>
            <span className="modal-icon">
              <SlidersHorizontal size={24} />
            </span>
            <h2 id="adjust-title">Make the plan fit your life.</h2>
            <p>
              Update your time or device. Completed tasks stay as they are, and
              unfinished weeks adjust to your availability.
            </p>
            <form onSubmit={adjust}>
              <div className="form-grid">
                <label>
                  Hours per week
                  <input
                    type="number"
                    required
                    min={1}
                    max={20}
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                  />
                </label>
                <label>
                  Main device
                  <select
                    value={device}
                    onChange={(e) => setDevice(e.target.value)}
                  >
                    <option value="laptop">Laptop / desktop</option>
                    <option value="phone">Phone</option>
                  </select>
                </label>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={lowData}
                  onChange={(e) => setLowData(e.target.checked)}
                />
                Prefer less data use
              </label>
              {error && <p className="form-error">{error}</p>}
              <button className="primary wide" disabled={busy}>
                {busy ? "Updating…" : "Update my plan"}
                <ArrowRight size={17} />
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
