import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Briefcase,
  GraduationCap,
  LoaderCircle,
} from "lucide-react";
import { api } from "../../shared/api";
import { navigateApp } from "../../app/useSectionRoute";
import { isDirectSource } from "../../shared/sourceLinks";
import type { State } from "../../shared/types";
type Guide = {
  resources: {
    id: string;
    title: string;
    provider: string;
    url: string;
    skill: string;
    access_note?: string;
  }[];
  places: {
    name: string;
    location: string;
    url: string;
    entry_route: string;
  }[];
  opportunities: {
    title: string;
    provider: string;
    url: string;
    deadline_note: string;
    eligibility: string;
  }[];
};
type Job = {
  id: string;
  status: string;
  stage: string;
  result?: Guide;
  error?: string;
};
export default function GoalLaunchpad({
  state,
  market,
  refreshToken = 0,
}: {
  state: State;
  market: string;
  refreshToken?: number;
}) {
  const [job, setJob] = useState<Job | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setJob(null);
    setError("");
    async function load() {
      try {
        const result = await api<Job | null>(
          `/me/research?market=${encodeURIComponent(market)}`,
        );
        if (!active) return;
        setJob(result);
        if (result && ["running", "queued"].includes(result.status))
          timer = setTimeout(load, 2500);
      } catch {
        if (active)
          setError("Your guide could not load. Reopen Discover to retry.");
      }
    }
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [state.goal_id, state.profile.goal, market, refreshToken]);
  const guide = job?.status === "complete" ? job.result : null;
  const resources = (guide?.resources ?? [])
    .filter((r) => isDirectSource(r.url))
    .slice(0, 2);
  const opening = guide?.opportunities?.find((o) => isDirectSource(o.url));
  const place = guide?.places?.find((p) => isDirectSource(p.url));
  return (
    <section
      className="goal-launchpad"
      aria-label="Your goal learning and opportunities"
    >
      <header>
        <div>
          <span className="public-eyebrow">
            LEARN → PRACTISE → YOUR NEXT OPPORTUNITY
          </span>
          <h2>Your next move</h2>
        </div>
        <button
          className="text-link"
          onClick={() => navigateApp("/app/discover")}
        >
          Explore your guide <ArrowRight size={14} />
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {job && ["running", "queued"].includes(job.status) ? (
        <p role="status">
          <LoaderCircle size={14} className="spin" />{" "}
          {job.stage || "Finding sources for your goal…"}
        </p>
      ) : guide ? (
        <div className="goal-launchpad-grid">
          <div>
            <h3>
              <BookOpen size={16} /> Start learning
            </h3>
            {resources.map((r) => (
              <a
                className="goal-source-row"
                key={r.id}
                href={r.url}
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  <strong>{r.title}</strong>
                  <small>
                    {r.provider} · {r.skill}
                  </small>
                  {r.access_note && <small>{r.access_note}</small>}
                </span>
                <ArrowUpRight size={14} />
              </a>
            ))}
            {!resources.length && (
              <p>
                No direct learning source verified yet. Refresh your research in
                Discover.
              </p>
            )}
          </div>
          <div>
            <h3>
              {opening ? <Briefcase size={16} /> : <GraduationCap size={16} />}{" "}
              {opening
                ? "An opportunity to work towards"
                : "Your training route"}
            </h3>
            {opening ? (
              <>
                <a
                  className="goal-source-row"
                  href={opening.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>
                    <strong>{opening.title}</strong>
                    <small>{opening.provider}</small>
                  </span>
                  <ArrowUpRight size={14} />
                </a>
                <p>{opening.deadline_note}</p>
                <details>
                  <summary>What you need</summary>
                  <p>{opening.eligibility}</p>
                </details>
              </>
            ) : place ? (
              <>
                <a
                  className="goal-source-row"
                  href={place.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>
                    <strong>{place.name}</strong>
                    <small>{place.location}</small>
                  </span>
                  <ArrowUpRight size={14} />
                </a>
                <p>{place.entry_route}</p>
              </>
            ) : (
              <p>
                No current opportunity verified for this goal in {market}. Keep
                learning and refresh your guide for new calls.
              </p>
            )}
            <small className="subtle">
              Source availability can change. Check the original page before
              applying.
            </small>
          </div>
        </div>
      ) : (
        <div className="goal-launchpad-empty">
          <p>
            {job?.status === "failed"
              ? "Research did not finish. Your saved work is safe."
              : `Find learning and training routes for “${state.profile.goal}” in ${market}.`}
          </p>
          <button
            className="primary"
            onClick={() => navigateApp("/app/discover")}
          >
            Find resources & opportunities <ArrowRight size={14} />
          </button>
        </div>
      )}
    </section>
  );
}
