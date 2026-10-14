import { useEffect, useState } from "react";
import { api } from "../../shared/api";
import { isDirectSource } from "../../shared/sourceLinks";
import { relatedSkill } from "../../shared/goalComparison";
type Opening = {
  title: string;
  provider: string;
  url: string;
  location: string;
  type: string;
  required_skills: string[];
  published_date?: string;
  deadline?: string;
  open_status: string;
  eligibility: string;
};
type Research = {
  status: string;
  result?: {
    goal: string;
    researched_at: string;
    opportunities: Opening[];
    sources: { url: string }[];
  };
};
export default function GoalOpenings({
  goal,
  market,
  refreshVersion,
}: {
  goal: string;
  market: string;
  refreshVersion: number;
}) {
  const [research, setResearch] = useState<Research | null>(null);
  const [skills, setSkills] = useState<
    { name: string; evidence_count: number }[]
  >([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setResearch(null);
    setSelected(null);
    setSkills([]);
    setError("");
    if (goal)
      Promise.allSettled([
        api<Research | null>(
          `/me/research?market=${encodeURIComponent(market)}`,
        ),
        api<{ skills: typeof skills }>("/me/skills"),
      ]).then(([guide, evidence]) => {
        if (!active) return;
        if (guide.status === "fulfilled") setResearch(guide.value);
        else
          setError("Saved openings could not load. Retry refreshing the bank.");
        if (evidence.status === "fulfilled")
          setSkills(evidence.value.skills || []);
      });
    return () => {
      active = false;
    };
  }, [goal, market, refreshVersion]);
  const result =
    research?.status === "complete" && research.result?.goal === goal
      ? research.result
      : null;
  const openings = (result?.opportunities || []).filter(
    (item) =>
      item.open_status === "current_open" &&
      (!item.deadline ||
        new Date(`${item.deadline}T23:59:59Z`).getTime() >= Date.now()) &&
      isDirectSource(item.url) &&
      result?.sources.some((source) => source.url === item.url),
  );
  return (
    <section className="goal-openings" aria-label="Openings for my goal">
      <h3>Openings for your goal</h3>
      {error && <p role="alert">{error}</p>}
      {!openings.length && (
        <p>
          No sourced opening saved for this goal and location yet. Refresh your
          goal research in Discover to search current calls.
        </p>
      )}
      {openings.map((item) => {
        const expired =
          !!item.deadline &&
          new Date(`${item.deadline}T23:59:59Z`).getTime() < Date.now();
        const closed = expired || item.open_status === "closed";
        const days = item.published_date
          ? Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(item.published_date).getTime()) /
                  86400000,
              ),
            )
          : null;
        return (
          <article key={item.url}>
            <h4>{item.title}</h4>
            <p>
              {item.provider} · {item.location} · {item.type}
            </p>
            <span className="status-badge">
              {closed
                ? "Closed / deadline passed"
                : item.open_status === "current_open"
                  ? "Reported open at research"
                  : "Availability unverified"}
            </span>
            <p className="privacy-note">
              {days !== null && Number.isFinite(days)
                ? `Published ${days} days ago (${item.published_date})`
                : "Publication date unknown"}{" "}
              · Checked {result?.researched_at?.slice(0, 10) || "date unknown"}
              {item.deadline ? ` · Deadline ${item.deadline}` : ""}
            </p>
            <a
              className="text-link"
              href={item.url}
              target="_blank"
              rel="noreferrer"
            >
              {closed ? "View original listing" : "View listing & apply"} ↗
            </a>
            <button
              className="text-link"
              onClick={() =>
                setSelected(selected === item.url ? null : item.url)
              }
            >
              Check eligibility against my goal
            </button>
            {selected === item.url && (
              <div className="resource-goal-comparison" aria-live="polite">
                <p>Your goal: {goal}</p>
                <p>{item.eligibility}</p>
                {item.required_skills.length ? (
                  <ul>
                    {item.required_skills.map((skill) => (
                      <li key={skill}>
                        {skills.some(
                          (e) =>
                            e.evidence_count > 0 && relatedSkill(skill, e.name),
                        )
                          ? "✓ Related saved evidence"
                          : "○ Evidence still needed"}
                        : {skill}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    The listing does not specify skills; a skill comparison is
                    unavailable. Check eligibility at the source.
                  </p>
                )}
                <small>
                  Saved evidence suggests topic overlap, not verified
                  proficiency. Confirm qualifications and current availability
                  with the provider.
                </small>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
