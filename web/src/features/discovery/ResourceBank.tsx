import { relatedSkill } from "../../shared/goalComparison";
import { useEffect, useState, useRef } from "react";
import { api } from "../../shared/api";
import { LocalCollection } from "../../shared/ui/Collection";
import ResourceCard from "./ResourceCard";
import type { Resource, State } from "../../shared/types";
type ResearchResource = {
  id: string;
  title: string;
  provider: string;
  url: string;
  format: string;
  access_note: string;
  why_it_fits: string;
  skill: string;
  access_type?: string;
};
export default function ResourceBank({
  state,
  market,
}: {
  state: State | null;
  market: string;
}) {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const comparisonRef = useRef<HTMLElement>(null);
  const [format, setFormat] = useState("all"),
    [pricing, setPricing] = useState("all"),
    [locationFilter, setLocationFilter] = useState("all"),
    [currency, setCurrency] = useState("USD"),
    [minimum, setMinimum] = useState(""),
    [maximum, setMaximum] = useState(""),
    [selected, setSelected] = useState<Resource | null>(null);
  useEffect(() => {
    if (selected)
      comparisonRef.current?.scrollIntoView?.({
        block: "nearest",
        behavior: "auto",
      });
  }, [selected]);
  const [skillEvidence, setSkillEvidence] = useState<
    { name: string; evidence_count: number; practised_weeks: number[] }[]
  >([]);
  const [reportedSkills, setReportedSkills] = useState<string[]>([]);
  const [evidenceLoaded, setEvidenceLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    setSelected(null);
    setSkillEvidence([]);
    setReportedSkills([]);
    setEvidenceLoaded(false);
    if (state?.profile.goal)
      Promise.allSettled([
        api<{
          skills: {
            name: string;
            evidence_count: number;
            practised_weeks: number[];
          }[];
        }>("/me/skills"),
        api<{ goal: string; skills: string[] }[]>("/me/cv-reviews"),
      ]).then(([skills, reviews]) => {
        if (!active) return;
        if (
          skills.status === "fulfilled" &&
          Array.isArray(skills.value.skills)
        ) {
          setSkillEvidence(skills.value.skills);
          setEvidenceLoaded(true);
        }
        if (reviews.status === "fulfilled" && Array.isArray(reviews.value))
          setReportedSkills(
            reviews.value
              .filter((review) => review.goal === state.profile.goal)
              .flatMap((review) => review.skills || []),
          );
      });
    return () => {
      active = false;
    };
  }, [state, market]);
  function key(value: string) {
    return value.toLowerCase().trim();
  }
  function costType(resource: Resource) {
    return /^free\b/i.test(resource.cost)
      ? "free"
      : /^paid\b/i.test(resource.cost)
        ? "paid"
        : "unknown";
  }
  const [catalog, setCatalog] = useState<Resource[]>([]),
    [goalResources, setGoalResources] = useState<Resource[]>([]),
    [scope, setScope] = useState(state?.profile.goal ? "goal" : "all"),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    setGoalResources([]);
    api<Resource[]>("/resources")
      .then((items) => {
        if (active && Array.isArray(items)) setCatalog(items);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    if (state?.profile.goal)
      api<{
        status: string;
        result?: {
          resources: ResearchResource[];
          paid_resources?: ResearchResource[];
        };
      } | null>(`/me/research?market=${encodeURIComponent(market)}`)
        .then((job) => {
          if (active && job?.status === "complete" && job.result)
            setGoalResources(
              [
                ...job.result.resources,
                ...(job.result.paid_resources || []),
              ].map((item) => ({
                id: item.id,
                title: item.title,
                provider: item.provider,
                url: item.url,
                format: item.format,
                device: "Check provider requirements",
                location: /online|web|video|text/i.test(item.format)
                  ? "Online"
                  : null,
                cost:
                  item.access_type === "paid_program"
                    ? `Paid · ${item.access_note}`
                    : `Free content · ${item.access_note}`,
                review: item.why_it_fits,
                skills: state?.plan?.resources?.find(
                  (resource) => resource.id === item.id,
                )?.skills || [item.skill],
              })),
            );
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [state?.goal_id, state?.profile.goal, market, refreshVersion]);
  const items =
    scope === "goal"
      ? goalResources
      : Array.from(
          new Map(
            [...catalog, ...goalResources].map((item) => [item.url, item]),
          ).values(),
        );
  const filtered = items.filter((resource) => {
    if (
      format !== "all" &&
      !`${resource.format} ${resource.title}`
        .toLowerCase()
        .includes(format.toLowerCase())
    )
      return false;
    if (pricing !== "all" && costType(resource) !== pricing) return false;
    if (locationFilter === "unknown" && resource.location) return false;
    if (
      locationFilter !== "all" &&
      locationFilter !== "unknown" &&
      resource.location !== locationFilter
    )
      return false;
    if (minimum !== "" || maximum !== "") {
      if (
        costType(resource) !== "free" &&
        (resource.price_currency !== currency || resource.price_amount == null)
      )
        return false;
      if (
        minimum !== "" &&
        (costType(resource) === "free" ? 0 : resource.price_amount!) <
          Number(minimum)
      )
        return false;
      if (
        maximum !== "" &&
        (costType(resource) === "free" ? 0 : resource.price_amount!) >
          Number(maximum)
      )
        return false;
    }
    return true;
  });
  const targets = skillEvidence.map((skill) => skill.name);
  const evidenced = skillEvidence
    .filter((skill) => skill.evidence_count > 0)
    .map((skill) => skill.name);
  const remaining = targets.filter(
    (skill) => !evidenced.some((item) => key(item) === key(skill)),
  );
  const supportedByResource = (selected?.skills || []).filter((skill) =>
    targets.some((target) => relatedSkill(target, skill)),
  );
  return (
    <section className="resource-bank">
      <header className="library-result-summary">
        <h2>Resource bank</h2>
        <button
          className="text-link"
          onClick={() => setRefreshVersion((value) => value + 1)}
        >
          Refresh resource bank
        </button>
      </header>
      <p>
        Search published learning sources and the free or paid sources found for
        your goal.
      </p>
      <div className="workspace-sections">
        <button
          aria-pressed={scope === "goal"}
          onClick={() => setScope("goal")}
        >
          For my goal
        </button>
        <button aria-pressed={scope === "all"} onClick={() => setScope("all")}>
          All sources
        </button>
      </div>
      <div className="resource-library-filters">
        <label>
          Resource type
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="all">All types</option>
            <option value="ebook">Ebooks</option>
            <option value="textbook">Textbooks</option>
            <option value="library">Libraries</option>
            {Array.from(new Set(items.map((item) => item.format)))
              .sort()
              .map((value) => (
                <option key={value}>{value}</option>
              ))}
          </select>
        </label>
        <label>
          Pricing
          <select value={pricing} onChange={(e) => setPricing(e.target.value)}>
            <option value="all">Any price</option>
            <option value="free">Free content</option>
            <option value="paid">Paid</option>
            <option value="unknown">Price unverified</option>
          </select>
        </label>
        <label>
          Location
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="all">All locations / unknown</option>
            <option value="unknown">Location unverified</option>
            {Array.from(
              new Set(
                [
                  "Online",
                  "Nigeria",
                  "Rwanda",
                  "Global",
                  ...items.map((item) => item.location),
                ].filter((value): value is string => !!value),
              ),
            )
              .sort()
              .map((value) => (
                <option key={value}>{value}</option>
              ))}
          </select>
        </label>
        <label>
          Currency
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option>USD</option>
            <option>NGN</option>
            <option>RWF</option>
          </select>
        </label>
        <label>
          Minimum price
          <input
            type="number"
            min="0"
            value={minimum}
            onChange={(e) => setMinimum(e.target.value)}
            placeholder="Any"
          />
        </label>
        <label>
          Maximum price
          <input
            type="number"
            min="0"
            value={maximum}
            onChange={(e) => setMaximum(e.target.value)}
            placeholder="Any"
          />
        </label>
      </div>
      {(minimum !== "" || maximum !== "") && (
        <p className="privacy-note">
          Price range shows only explicit amounts in {currency}. Unknown prices
          and other currencies are excluded; currencies are not converted.
        </p>
      )}
      {minimum !== "" &&
        maximum !== "" &&
        Number(minimum) > Number(maximum) && (
          <p role="alert">Minimum price must not exceed maximum price.</p>
        )}
      <div className="library-result-summary">
        <span>{filtered.length} resources</span>
        <button
          className="text-link"
          onClick={() => {
            setFormat("all");
            setPricing("all");
            setLocationFilter("all");
            setMinimum("");
            setMaximum("");
          }}
        >
          Reset filters
        </button>
      </div>
      {selected && (
        <section
          ref={comparisonRef}
          className="resource-goal-comparison"
          aria-label="Resource goal comparison"
          aria-live="polite"
        >
          <header>
            <h3>{selected.title} · Your goal fit</h3>
            <button className="text-link" onClick={() => setSelected(null)}>
              Close comparison
            </button>
          </header>
          <p>
            Goal:{" "}
            {state?.profile.goal || "Set a goal to compare this resource."}
          </p>
          {!evidenceLoaded ? (
            <p>
              Goal evidence is unavailable. Set a plan or review your skills
              before assessing fit.
            </p>
          ) : (
            <>
              <h4>What this resource supports</h4>
              <p>
                {supportedByResource.join(", ") ||
                  (state?.profile.goal &&
                  relatedSkill(
                    `${selected.title} ${selected.review} ${(selected.skills || []).join(" ")}`,
                    state.profile.goal,
                  )
                    ? "Related to your stated goal. Build a learning plan to compare its specific skill targets."
                    : "No clear topic overlap was found. This is uncertain relevance, not a decision that the resource cannot help.")}
              </p>
              <h4>Skills with saved evidence</h4>
              <p>{evidenced.join(", ") || "No skill evidence saved yet."}</p>
              <h4>Remaining learning targets without evidence</h4>
              <p>
                {remaining.join(", ") ||
                  (targets.length
                    ? "All recorded targets have evidence; this does not verify proficiency or job eligibility."
                    : "No learning targets recorded yet. Build a goal plan before assessing coverage.")}
              </p>
              {reportedSkills.length > 0 && (
                <p>
                  CV-reported skills:{" "}
                  {Array.from(new Set(reportedSkills)).join(", ")} ·
                  self-reported, not verified.
                </p>
              )}
              <a className="text-link" href="/app/progress?view=practice">
                Test and strengthen your skills →
              </a>
            </>
          )}
          <p className="privacy-note">
            Comparison uses your current plan and recorded work. A course title
            or completed task alone cannot establish career readiness.
          </p>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      {scope === "goal" && !items.length && (
        <p>
          Research your goal to collect its sources here. All sources lets you
          browse the published bank.
        </p>
      )}
      <LocalCollection
        items={filtered}
        label="learning resources"
        pageSize={6}
        searchable
      >
        {(resources) => (
          <div className="resource-bank-grid">
            {resources.map((resource) => (
              <div key={resource.url}>
                <ResourceCard resource={resource} />
                <button
                  className="secondary"
                  onClick={() => setSelected(resource)}
                >
                  Compare with my goal
                </button>
                {resource.price_amount != null && (
                  <small>
                    {resource.price_currency} {resource.price_amount} ·
                    published amount
                  </small>
                )}
              </div>
            ))}
          </div>
        )}
      </LocalCollection>
    </section>
  );
}
