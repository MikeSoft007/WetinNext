import { useEffect, useState, useRef } from "react";
import { Plus, ArrowRight, Trash2, X, Target } from "lucide-react";
import { api } from "../../shared/api";
import type { State } from "../../shared/types";
type Goal = {
  id: string;
  goal: string;
  active: boolean;
  completed_weeks: number;
  has_plan: boolean;
  country: string;
};
export default function GoalSwitcher({
  state,
  onAdd,
  onSwitched,
}: {
  state: State | null;
  onAdd: () => void;
  onSwitched: () => Promise<void>;
}) {
  const [goals, setGoals] = useState<Goal[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!state) return;
    let active = true;
    setError("");
    api<Goal[]>("/me/goals")
      .then((data) => {
        if (active) setGoals(data);
      })
      .catch((e) => {
        if (active)
          setError(
            (e as Error).message === "Not Found"
              ? "Goal history could not load. Refresh this page to reconnect."
              : (e as Error).message,
          );
      });
    return () => {
      active = false;
    };
  }, [state]);
  const [managing, setManaging] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (managing) dialog.current?.showModal();
    else dialog.current?.close();
  }, [managing]);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  async function removeGoal() {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      await api(`/me/goals/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      await onSwitched();
      setGoals(await api<Goal[]>("/me/goals"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function activate(id: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/me/goals/${id}/activate`, { method: "POST" });
      await onSwitched();
    } catch (e) {
      setError(
        (e as Error).message === "Not Found"
          ? "Goal history could not load. Refresh this page to reconnect."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="goal-switcher">
      <div>
        <label htmlFor="active-goal">Working towards</label>
        {!goals.length ? (
          <button className="text-link" onClick={onAdd}>
            {state?.profile.goal || "Choose your first goal"}
            <ArrowRight size={15} />
          </button>
        ) : (
          <select
            id="active-goal"
            disabled={busy || !goals.length}
            value={goals.find((goal) => goal.active)?.id || ""}
            onChange={(e) => void activate(e.target.value)}
          >
            {!goals.length && <option value="">Choose your first goal</option>}
            {goals.map((goal) => (
              <option value={goal.id} key={goal.id}>
                {goal.goal}
              </option>
            ))}
          </select>
        )}
      </div>
      <button className="text-link" disabled={busy} onClick={onAdd}>
        <Plus size={15} />
        Add a goal
      </button>
      {goals.length > 0 && (
        <button
          className="secondary"
          onClick={() => {
            setDeleting(null);
            setManaging(true);
          }}
        >
          Manage goals · {goals.length}
        </button>
      )}
      <dialog
        ref={dialog}
        className="goal-manager"
        aria-labelledby="goal-manager-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else {
            setManaging(false);
            setDeleting(null);
          }
        }}
      >
        <header>
          <div>
            <span className="public-eyebrow">YOUR DIRECTIONS</span>
            <h2 id="goal-manager-title">
              {deleting ? "Delete this goal?" : "My goals"}
            </h2>
          </div>
          <button
            aria-label="Close goal manager"
            disabled={busy}
            onClick={() => {
              setManaging(false);
              setDeleting(null);
            }}
          >
            <X size={20} />
          </button>
        </header>
        {deleting ? (
          <section
            className="goal-manager-confirm"
            role="alertdialog"
            aria-label="Confirm goal deletion"
          >
            <div className="goal-to-delete">
              <Target size={20} />
              <strong>{deleting.goal}</strong>
            </div>
            <p>
              Its plan, saved work, practice attempts and learning picks will be
              removed. This cannot be undone.
            </p>
            <p className="privacy-note">
              Your profile, other goals and uploaded CV reviews remain.
            </p>
            {deleting.active && (
              <p className="privacy-note">
                {goals.length > 1
                  ? "Your most recently used remaining goal will become active."
                  : "You can choose a new goal after deleting this one."}
              </p>
            )}
            {error && <p role="alert">{error}</p>}
            <footer>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Keep goal
              </button>
              <button
                className="goal-danger"
                disabled={busy}
                onClick={() => void removeGoal()}
              >
                <Trash2 size={15} />
                {busy ? "Deleting…" : "Delete goal"}
              </button>
            </footer>
          </section>
        ) : (
          <>
            <p className="privacy-note">
              Switch your focus or remove a goal you no longer need.
            </p>
            <div className="goal-manager-list">
              {goals.map((goal) => (
                <div key={goal.id} className="goal-manager-row">
                  <div className="goal-manager-icon">
                    <Target size={19} />
                  </div>
                  <div className="goal-manager-info">
                    <strong>{goal.goal}</strong>
                    <small>
                      {goal.has_plan
                        ? `${goal.completed_weeks} weeks complete`
                        : "Plan not started"}{" "}
                      · {goal.country}
                    </small>
                  </div>
                  {goal.active ? (
                    <span className="goal-active-label">Current</span>
                  ) : (
                    <button
                      disabled={busy}
                      className="goal-switch-action"
                      onClick={async () => {
                        await activate(goal.id);
                        setManaging(false);
                      }}
                    >
                      Switch <ArrowRight size={14} />
                    </button>
                  )}
                  <button
                    className="goal-remove-action"
                    aria-label={`Delete goal: ${goal.goal}`}
                    disabled={busy}
                    onClick={() => {
                      setError("");
                      setDeleting(goal);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <footer>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setManaging(false);
                  onAdd();
                }}
              >
                <Plus size={15} />
                Add another goal
              </button>
            </footer>
          </>
        )}
      </dialog>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
