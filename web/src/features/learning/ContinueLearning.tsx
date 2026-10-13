import { useEffect, useState } from "react";
import { BookOpen, Check, ArrowUpRight } from "lucide-react";
import { api } from "../../shared/api";
import { LocalCollection } from "../../shared/ui/Collection";
import type { State } from "../../shared/types";
export type LearningPick = {
  id: string;
  title: string;
  url: string;
  provider: string;
  format: string;
  skill: string;
  status: "saved" | "reading" | "read";
  updated_at: string;
};
export default function ContinueLearning({
  state,
  market,
}: {
  state: State | null;
  market: string;
}) {
  const [picks, setPicks] = useState<LearningPick[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setPicks([]);
    setError("");
    if (state?.profile.goal)
      api<LearningPick[]>(
        `/me/learning-picks?market=${encodeURIComponent(market)}`,
      )
        .then((data) => {
          if (active && Array.isArray(data)) setPicks(data);
        })
        .catch(() => {
          if (active)
            setError("Saved learning could not load. Please refresh.");
        });
    return () => {
      active = false;
    };
  }, [state?.goal_id, state?.profile.goal, market]);
  async function update(pick: LearningPick, status: LearningPick["status"]) {
    try {
      const next = await api<LearningPick>(`/me/learning-picks/${pick.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setPicks((items) =>
        items.map((item) => (item.id === next.id ? next : item)),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!picks.length) return error ? <p role="alert">{error}</p> : null;
  const unread = picks.filter((pick) => pick.status !== "read");
  return (
    <section className="continue-learning">
      <header>
        <div>
          <span className="eyebrow">YOUR LEARNING, REMEMBERED</span>
          <h2>Pick up where you left off</h2>
        </div>
        <span>
          {picks.filter((p) => p.status === "read").length}/{picks.length} read
        </span>
      </header>
      <LocalCollection
        items={unread.length ? unread : picks}
        label="saved learning"
        pageSize={2}
        searchable={false}
      >
        {(visible) =>
          visible.map((pick) => (
            <article key={pick.id}>
              <span className="continue-icon">
                <BookOpen size={20} />
              </span>
              <div>
                <small>
                  {pick.provider} ·{" "}
                  {pick.status === "reading"
                    ? "In progress"
                    : pick.status === "read"
                      ? "Read"
                      : "Saved for later"}
                </small>
                <h3>{pick.title}</h3>
                <a
                  href={pick.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => void update(pick, "reading")}
                >
                  {pick.status === "saved"
                    ? "Start reading"
                    : "Continue reading"}
                  <ArrowUpRight size={14} />
                </a>
              </div>
              <button
                className="text-link"
                onClick={() =>
                  void update(pick, pick.status === "read" ? "saved" : "read")
                }
              >
                <Check size={14} />
                {pick.status === "read" ? "Read again" : "Mark read"}
              </button>
            </article>
          ))
        }
      </LocalCollection>
      {error && <p role="alert">{error}</p>}
      <small className="privacy-note">
        Reading is self-reported. Keep a reflection or work sample in your
        weekly task.
      </small>
    </section>
  );
}
