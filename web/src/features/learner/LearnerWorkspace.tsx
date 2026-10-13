import GoalPreparation, { FocusReminder } from "../progress/GoalPreparation";
import GoalSwitcher from "../goals/GoalSwitcher";
import SkillTracker from "../progress/SkillTracker";
import ReadinessCheck from "../progress/ReadinessCheck";
import GoalResearch from "../discovery/GoalResearch";
import ProgressOverview from "../progress/ProgressOverview";
import LinkedInBridge from "../discovery/LinkedInBridge";
import WeekWorkbench, { EvidencePortfolio } from "../learning/WeekWorkbench";
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
import { MatchAnalyzer } from "../opportunities/MatchAnalyzer";
import TodayRecoveryActions from "../learning/TodayRecoveryActions";
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
  { label: "Today", icon: Route },
  { label: "Discover", icon: Compass },
  { label: "Progress", icon: History },
];
export default function LearnerWorkspace({
  onSignOut,
}: {
  onSignOut: () => Promise<void>;
}) {
  const [researchVersion, setResearchVersion] = useState(0);
  const [state, setState] = useState<State | null>(null),
    [resources, setResources] = useState<Resource[]>([]),
    [opps, setOpps] = useState<Opportunity[]>([]),
    [history, setHistory] = useState<HistoryEntry[]>([]);
  const [page, setPage] = useSectionRoute(learnerRoutes);
  const [progressTab, setProgressTab] = useState(() =>
    new URLSearchParams(location.search).get("view") === "practice"
      ? "practice"
      : "overview",
  );
  useEffect(() => {
    const sync = () => {
      if (location.pathname === "/app/progress")
        setProgressTab(
          new URLSearchParams(location.search).get("view") === "practice"
            ? "practice"
            : "overview",
        );
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
    [note, setNote] = useState(""),
    [deleteOpen, setDeleteOpen] = useState(false),
    [adjustOpen, setAdjustOpen] = useState(false),
    [hours, setHours] = useState(3),
    [device, setDevice] = useState("laptop"),
    [lowData, setLowData] = useState(true),
    [telegram, setTelegram] = useState<string | null>(null),
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
        setTelegram(health.telegram_bot_url);
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
            name: state?.profile.name || profile.name,
          }),
        },
      );
      await refresh();
      setSetup(false);
      setPage("Today");
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
  async function checkIn(status: string) {
    if (!week) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ advice: string }>(
        `/weeks/${week.week}/check-in`,
        { method: "POST", body: JSON.stringify({ status, note }) },
      );
      await refresh();
      setToast(result.advice);
      setNote("");
    } catch (e) {
      setError((e as Error).message);
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
    week = plan?.weeks.find(
      (w) => state?.progress[String(w.week)]?.status !== "done",
    ),
    name = state?.profile.name?.split(" ")[0];
  const pageTitles: Record<string, string> = {
    Today: "Today",
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
            setPage("Today");
          }}
        >
          <span className="brand-icon">
            <Sprout size={22} />
          </span>
          Wetin<span>Next</span>
          <span className="brand-dot">.</span>
        </a>
        <div className="market-switch" aria-label="Active opportunity market">
          {["Nigeria", "Rwanda", "Global"].map((m) => (
            <button
              key={m}
              aria-pressed={market === m}
              className={market === m ? "selected" : ""}
              onClick={() => setMarket(m)}
            >
              <span>
                {m === "Nigeria" ? "🇳🇬" : m === "Rwanda" ? "🇷🇼" : "🌐"}
              </span>
              {m}
            </button>
          ))}
        </div>
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
          {telegram ? (
            <a
              className="telegram-button"
              href={telegram}
              target="_blank"
              rel="noreferrer"
              aria-label="Open Telegram bot"
            >
              <Send size={18} />
            </a>
          ) : (
            <button
              className="telegram-button"
              aria-label="Telegram bot connection status"
              onClick={() =>
                setToast(
                  "Telegram is not connected yet. A real bot URL can be configured on the backend.",
                )
              }
            >
              <Send size={18} />
            </button>
          )}
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
          <a
            className="nav-item"
            href="/cv"
            aria-label="CV review and next actions"
          >
            <FileText size={18} />
            <span>CV review</span>
          </a>
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
              setPage("Today");
            }}
          />
        )}
        <section
          className={`page-heading page-heading--${page === "Opportunity fit" ? "opportunity" : page.toLowerCase()}`}
        >
          <h1>{pageTitles[page]}</h1>
          {page === "Today" && plan && (
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
        {page === "Today" && state?.profile.goal && (
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
        {!ready && !error ? (
          <div className="loading-inline">
            <LoaderCircle className="spin" size={20} />
            Loading your workspace…
          </div>
        ) : (
          <>
            {page === "Today" && <FocusReminder state={state} />}
            {page === "Today" && !plan && (
              <section className="card next-task today-start-card">
                <h2>
                  {state?.profile.goal
                    ? "Find one useful first step."
                    : "Start with a goal that matters to you."}
                </h2>
                <p>
                  {state?.profile.goal
                    ? "Find a credible resource or build a practical learning plan."
                    : "Choose a direction. You can change it later."}
                </p>
                <button
                  className="primary"
                  onClick={() =>
                    state?.profile.goal
                      ? navigateApp("/app/discover?view=plan")
                      : setSetup(true)
                  }
                >
                  {state?.profile.goal
                    ? "Find my first learning step"
                    : "Choose my learning goal"}
                  <ArrowRight size={16} />
                </button>
              </section>
            )}
            {page === "Today" && plan && (
              <section className="card next-task today-next-task">
                <h2>{week?.title || "Your first sprint is complete"}</h2>
                <p>
                  {week?.task ||
                    "Review your saved work and choose what you would like to build next."}
                </p>
                {week ? (
                  <>
                    <WeekWorkbench
                      week={week}
                      planId={plan.id}
                      status={state?.progress[String(week.week)]?.status}
                    />
                    <details className="today-recovery">
                      <summary>Need more time or a different resource?</summary>
                      <TodayRecoveryActions
                        busy={busy}
                        note={note}
                        advice={state?.progress[String(week.week)]?.advice}
                        onNoteChange={setNote}
                        onCheckIn={(status) => void checkIn(status)}
                        onAdjust={openAdjust}
                        onDiscover={() => setPage("Discover")}
                      />
                    </details>
                  </>
                ) : (
                  <button
                    className="primary"
                    onClick={() => setPage("Progress")}
                  >
                    Review my saved work
                    <ArrowRight size={16} />
                  </button>
                )}
              </section>
            )}
            {(page === "Today" || page === "Discover") && (
              <GoalResearch
                state={state}
                market={market}
                onSaved={refresh}
                onSetup={() => setSetup(true)}
                compact={page === "Today"}
                refreshToken={researchVersion}
                query={page === "Discover" ? search : ""}
              />
            )}
            {page === "Discover" && state?.profile.goal && (
              <details className="catalogue-more">
                <summary>Explore LinkedIn for this goal</summary>
                <LinkedInBridge goal={state.profile.goal} market={market} />
              </details>
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
                    ["skills", "Skills"],
                    ["practice", "Practice quiz"],
                    ["portfolio", "My evidence"],
                    ["history", "History"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      aria-pressed={progressTab === id}
                      onClick={() => setProgressTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
                <div hidden={progressTab !== "overview"}>
                  <ProgressOverview
                    state={personalisedState}
                    onStart={() => setSetup(true)}
                    onContinue={() => setPage("Today")}
                  />
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
                  <HistoryPanel
                    history={history}
                    country={state?.profile.country}
                    onPathway={() => setPage("Today")}
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
      {setup && (
        <OnboardingModal
          hasProfile={!!state?.profile.name}
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
                    setPage("Today");
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
