import { useEffect, useState } from "react";
import { Plus, ArrowRight } from "lucide-react";
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
      {goals.length > 1 && (
        <details>
          <summary>{goals.length} goals · History</summary>
          <div className="goal-history">
            {goals.map((goal) => (
              <button
                key={goal.id}
                disabled={busy || goal.active}
                onClick={() => void activate(goal.id)}
              >
                <span>
                  <strong>{goal.goal}</strong>
                  <small>
                    {goal.has_plan
                      ? `${goal.completed_weeks}/4 weeks complete`
                      : "Plan not started"}{" "}
                    · {goal.country}
                  </small>
                </span>
                <span>{goal.active ? "Active" : <ArrowRight size={15} />}</span>
              </button>
            ))}
          </div>
        </details>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
