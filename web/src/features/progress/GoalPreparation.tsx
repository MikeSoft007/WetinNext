import { LocalCollection } from "../../shared/ui/Collection";
import { useEffect, useState } from "react";
import { Bell, Check, ArrowUpRight, Target } from "lucide-react";
import { api } from "../../shared/api";
import { navigateApp } from "../../app/useSectionRoute";
import type { State } from "../../shared/types";
type Reminder = {
  enabled: boolean;
  days: number[];
  time: string;
  timezone: string;
  focus: string;
  due?: boolean;
};
type Goal = {
  id: string;
  goal: string;
  active: boolean;
  signals: { label: string; done: boolean }[];
  completed_signals: number;
  weeks: { week: number; title: string; done: boolean }[];
  evidence_count: number;
  next_focus: string;
  reminder: Reminder;
};
const targets: Record<string, string> = {
  Plan: "/app/discover?view=plan",
  Practice: "/app/progress?view=plan",
  Evidence: "/app/progress?view=plan",
  Quiz: "/app/progress?view=practice#practice-check",
  CV: "/app/review",
};
export default function GoalPreparation({
  state,
  onSwitch,
}: {
  state: State | null;
  onSwitch: () => Promise<void>;
}) {
  const [goals, setGoals] = useState<Goal[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [settings, setSettings] = useState<Reminder | null>(null);
  async function load() {
    const result = await api<{ goals: Goal[] }>("/me/preparation");
    setGoals(result.goals);
    setSettings(result.goals.find((g) => g.active)?.reminder || null);
  }
  useEffect(() => {
    if (!state) return;
    let active = true;
    setError("");
    api<{ goals: Goal[] }>("/me/preparation")
      .then((result) => {
        if (active) {
          setGoals(result.goals);
          setSettings(result.goals.find((g) => g.active)?.reminder || null);
        }
      })
      .catch(() => {
        if (active) setError("Preparation could not load. Please refresh.");
      });
    return () => {
      active = false;
    };
  }, [state]);
  async function focus(goal: Goal, label: string) {
    setBusy(true);
    setError("");
    try {
      if (!goal.active) {
        await api(`/me/goals/${goal.id}/activate`, { method: "POST" });
        await onSwitch();
      }
      navigateApp(targets[label] || "/app");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!settings) return;
    setBusy(true);
    setMessage("");
    try {
      await api("/me/reminders", {
        method: "PUT",
        body: JSON.stringify({
          enabled: settings.enabled,
          days: settings.days,
          time: settings.time,
          timezone: settings.timezone,
          focus: settings.focus,
        }),
      });
      await load();
      setMessage("Reminder preferences saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function dismiss() {
    await api("/me/reminders/acknowledge", { method: "POST" });
    await load();
  }
  const active = goals.find((g) => g.active);
  if (!goals.length && !error) return null;
  return (
    <section className="goal-preparation">
      <header>
        <div>
          <span className="eyebrow">
            <Target size={13} /> YOUR DIRECTION, AT A GLANCE
          </span>
          <h2>How your goals are taking shape</h2>
          <p>Tap a signal to pick up where you left off.</p>
        </div>
        <span className="preparation-legend">
          <i />
          Recorded <i />
          Next to build
        </span>
      </header>
      {error && <p role="alert">{error}</p>}
      <div
        className="preparation-matrix"
        role="table"
        aria-label="Preparation signals by goal"
      >
        <div className="preparation-row preparation-labels" role="row">
          <span role="columnheader">Career goal</span>
          {["Plan", "Practice", "Evidence", "Quiz", "CV"].map((label) => (
            <span role="columnheader" key={label}>
              {label}
            </span>
          ))}
        </div>
        {
          <LocalCollection
            items={goals}
            label="saved goals"
            pageSize={4}
            searchable={false}
          >
            {(visible) =>
              visible.map((goal) => (
                <div className="preparation-row" role="row" key={goal.id}>
                  <div role="cell">
                    <strong>{goal.goal}</strong>
                    <small>
                      {goal.active ? "Current goal · " : ""}
                      {goal.completed_signals}/5 signals recorded
                    </small>
                  </div>
                  {goal.signals.map((signal) => (
                    <div role="cell" key={signal.label}>
                      <button
                        disabled={busy}
                        onClick={() => void focus(goal, signal.label)}
                        className={`preparation-cell ${signal.done ? "recorded" : "pending"}`}
                        aria-label={`${goal.goal}: ${signal.label} ${signal.done ? "recorded" : "not yet recorded"}`}
                        title={`${signal.label}: ${signal.done ? "activity recorded" : "take the next step"}`}
                      >
                        {signal.done ? <Check size={18} /> : <span />}
                      </button>
                    </div>
                  ))}
                </div>
              ))
            }
          </LocalCollection>
        }
      </div>
      <small className="skill-note">
        Recorded activity, not a mastery score or proof of job eligibility.
      </small>
      {active && (
        <div className="preparation-focus">
          <Target size={22} />
          <div>
            <small>YOUR NEXT FOCUS</small>
            <strong>
              {active.next_focus === "Review opportunity requirements"
                ? "Compare your evidence with an opportunity"
                : `Build your ${active.next_focus.toLowerCase()} signal`}
            </strong>
          </div>
          <button
            className="text-link"
            disabled={busy}
            onClick={() => void focus(active, active.next_focus)}
          >
            Continue
            <ArrowUpRight size={15} />
          </button>
        </div>
      )}
      {settings && (
        <details className="focus-reminders">
          <summary>
            <Bell size={16} />
            Focus reminders <span>{settings.enabled ? "On" : "Off"}</span>
          </summary>
          <p>
            In-app reminders appear when you return. Choose what deserves
            attention.
          </p>
          {settings.enabled && settings.due && (
            <div className="reminder-due" role="status">
              <strong>Time for {settings.focus}</strong>
              <button className="text-link" onClick={() => void dismiss()}>
                Mark reminder seen
                <Check size={14} />
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) =>
                  setSettings({ ...settings, enabled: e.target.checked })
                }
              />
              Remind me about this goal
            </label>
            <div className="reminder-fields">
              <label>
                Focus area
                <select
                  value={settings.focus}
                  onChange={(e) =>
                    setSettings({ ...settings, focus: e.target.value })
                  }
                >
                  {[
                    "weekly practice",
                    "saved evidence",
                    "practice quiz",
                    "CV review",
                    "opportunity preparation",
                  ].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
              <label>
                Time
                <input
                  type="time"
                  required
                  value={settings.time}
                  onChange={(e) =>
                    setSettings({ ...settings, time: e.target.value })
                  }
                />
              </label>
              <label>
                Timezone
                <select
                  value={settings.timezone}
                  onChange={(e) =>
                    setSettings({ ...settings, timezone: e.target.value })
                  }
                >
                  {["Africa/Lagos", "Africa/Kigali", "UTC"].map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="reminder-days" aria-label="Reminder weekdays">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                (day, index) => (
                  <button
                    type="button"
                    aria-pressed={settings.days.includes(index)}
                    key={day}
                    onClick={() =>
                      setSettings({
                        ...settings,
                        days: settings.days.includes(index)
                          ? settings.days.filter((d) => d !== index)
                          : [...settings.days, index],
                      })
                    }
                  >
                    {day}
                  </button>
                ),
              )}
            </div>
            <button
              className="secondary"
              disabled={busy || !settings.days.length}
            >
              {busy ? "Saving…" : "Save reminders"}
            </button>
            {message && <span role="status">{message}</span>}
          </form>
        </details>
      )}
    </section>
  );
}

export function FocusReminder({ state }: { state: State | null }) {
  const [reminder, setReminder] = useState<Reminder | null>(null);
  useEffect(() => {
    if (!state?.profile.goal) return;
    let active = true;
    api<Reminder>("/me/reminders")
      .then((data) => {
        if (active) setReminder(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [state]);
  if (!reminder?.enabled || !reminder.due) return null;
  return (
    <aside className="reminder-due" role="status">
      <span>
        <Bell size={15} /> Focus reminder · {reminder.focus}
      </span>
      <button
        className="text-link"
        onClick={() => navigateApp("/app/progress")}
      >
        Open my focus plan
        <ArrowUpRight size={14} />
      </button>
      <button
        className="text-link"
        onClick={() =>
          void api("/me/reminders/acknowledge", { method: "POST" }).then(() =>
            setReminder({ ...reminder, due: false }),
          )
        }
      >
        Seen
        <Check size={14} />
      </button>
    </aside>
  );
}
