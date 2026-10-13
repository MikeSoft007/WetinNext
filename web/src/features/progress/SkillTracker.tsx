import { LocalCollection } from "../../shared/ui/Collection";
import { useEffect, useState } from "react";
import { api } from "../../shared/api";
import type { State } from "../../shared/types";
type Skills = {
  goal: string;
  notice: string;
  skills: {
    name: string;
    planned_weeks: number[];
    practised_weeks: number[];
    evidence_count: number;
    next_week: number | null;
  }[];
};
export default function SkillTracker({ state }: { state: State | null }) {
  const [data, setData] = useState<Skills | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!state) return;
    let active = true;
    setError("");
    setData(null);
    api<Skills>("/me/skills")
      .then((next) => {
        if (active) setData(next);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [state]);
  return (
    <section className="skill-tracker">
      <header>
        <h2>Skills toward your goal</h2>
        <span>Practice → evidence → next step</span>
      </header>
      {error && (
        <p role="alert">Skills could not load. Refresh to reconnect.</p>
      )}
      {!data && !error && <p role="status">Loading your skill milestones…</p>}
      {data && !data.skills.length && (
        <p>Save a plan in Discover to see the skills you’ll practise.</p>
      )}
      {data && (
        <LocalCollection
          items={data.skills}
          label="goal skills"
          pageSize={5}
          searchable={false}
        >
          {(visible) =>
            visible.map((skill) => (
              <article key={skill.name}>
                <div>
                  <h3>{skill.name}</h3>
                  <small>
                    {skill.practised_weeks.length}/{skill.planned_weeks.length}{" "}
                    weeks practised · {skill.evidence_count} saved work{" "}
                    {skill.evidence_count === 1 ? "example" : "examples"}
                  </small>
                </div>
                <div
                  className="skill-milestones"
                  aria-label={`${skill.name}: ${skill.practised_weeks.length} of ${skill.planned_weeks.length} planned weeks practised`}
                >
                  {skill.planned_weeks.map((week) => (
                    <span
                      className={
                        skill.practised_weeks.includes(week) ? "done" : ""
                      }
                      key={week}
                      title={`Week ${week}`}
                    />
                  ))}
                </div>
                <a href="/app">
                  {skill.next_week
                    ? `Next: week ${skill.next_week}`
                    : "Review your evidence"}{" "}
                  ↗
                </a>
              </article>
            ))
          }
        </LocalCollection>
      )}
      {data?.skills.length ? (
        <small className="skill-note">{data.notice}</small>
      ) : null}
    </section>
  );
}
