import { useEffect, useState } from "react";
import { Check, Plus, Sprout, Trophy, ArrowUpRight } from "lucide-react";
import { api } from "../../shared/api";
import type { Resource } from "../../shared/types";
type Branch = {
  id: string;
  title: string;
  task: string;
  resource: Resource | null;
  completed: boolean;
};
export default function LearningBranches({
  planId,
  resources,
}: {
  planId: string;
  resources: Resource[];
}) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [task, setTask] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setBranches([]);
    setAdding(false);
    setError("");
    api<Branch[]>("/me/branches")
      .then((items) => {
        if (active) setBranches(items);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [planId]);
  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const branch = await api<Branch>("/me/branches", {
        method: "POST",
        body: JSON.stringify({ title, task, resource_id: resourceId }),
      });
      setBranches((previous) => [...previous, branch]);
      setAdding(false);
      setTitle("");
      setTask("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(branch: Branch) {
    setBusy(true);
    setError("");
    try {
      const saved = await api<Branch>(`/me/branches/${branch.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: !branch.completed }),
      });
      setBranches((previous) =>
        previous.map((item) => (item.id === saved.id ? saved : item)),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="learning-sidequests"
      aria-label="Optional learning branches"
    >
      <header>
        <div>
          <span className="public-eyebrow">GROW YOUR OWN PATH</span>
          <h3>
            <Sprout size={18} /> Side quests
          </h3>
        </div>
        <button className="secondary" onClick={() => setAdding(!adding)}>
          <Plus size={14} /> Add learning branch
        </button>
      </header>
      <p className="subtle">
        Explore a skill alongside your goal. Your main four weeks stay on track.
      </p>
      {error && <p role="alert">{error}</p>}
      {adding && (
        <form onSubmit={add} className="branch-builder">
          <label>
            Skill or topic
            <input
              required
              minLength={3}
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What would you like to explore?"
            />
          </label>
          <label>
            One practice task
            <textarea
              required
              minLength={3}
              maxLength={500}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="What will you try or make?"
            />
          </label>
          <label>
            Learning source
            <select
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
            >
              <option value="">Practice without a linked source</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
          <div>
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : "Grow this branch"}
            </button>
            <button
              type="button"
              className="text-link"
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="sidequest-grid">
        {branches.map((branch) => (
          <article
            key={branch.id}
            className={branch.completed ? "sidequest complete" : "sidequest"}
          >
            <span className="sidequest-icon">
              {branch.completed ? <Trophy size={20} /> : <Sprout size={20} />}
            </span>
            <h4>{branch.title}</h4>
            <p>{branch.task}</p>
            {branch.resource && (
              <a href={branch.resource.url} target="_blank" rel="noreferrer">
                {branch.resource.title}
                <ArrowUpRight size={12} />
              </a>
            )}
            <button
              className="text-link"
              disabled={busy}
              onClick={() => void toggle(branch)}
            >
              <Check size={14} />
              {branch.completed ? "Completed · undo" : "Mark complete"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
