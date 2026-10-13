import { useState } from "react";
import type { Opportunity } from "../../shared/types";
import { CatalogCollection } from "../../shared/ui/Collection";
export default function PublicOpportunities() {
  const [country, setCountry] = useState(
      () => sessionStorage.getItem("wetinnext-market") || "Nigeria",
    ),
    [query, setQuery] = useState("");
  return (
    <div className="management-page">
      <header className="management-header">
        <a className="public-brand" href="/">
          WetinNext.
        </a>
        <a href="/app/discover">Personalise my next steps ↗</a>
      </header>
      <main className="management-main">
        <h1>Public opportunities</h1>
        <p>
          Browse original listings freely. Confirm location eligibility with the
          employer.
        </p>
        <div className="admin-toolbar">
          <label>
            Market
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                sessionStorage.setItem("wetinnext-market", e.target.value);
              }}
            >
              <option>Nigeria</option>
              <option>Rwanda</option>
              <option>Global</option>
            </select>
          </label>
          <label>
            Search opportunities
            <input
              type="search"
              maxLength={100}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title, organisation or skill…"
            />
          </label>
        </div>
        <CatalogCollection<Opportunity>
          kind="opportunities"
          country={country}
          query={query}
          liveOnly
        >
          {(jobs) =>
            jobs.map((job) => (
              <article className="management-card" key={job.id}>
                <h2>{job.title}</h2>
                <p>
                  {job.organisation} · {job.country}
                </p>
                <p>{job.description}</p>
                <p>
                  {job.last_check_result || "Availability not verified"} · Last
                  checked:{" "}
                  {job.last_checked_at
                    ? new Date(job.last_checked_at).toLocaleString()
                    : "Not yet checked"}
                </p>
                <p>
                  Source: {job.source || "Editorial catalogue"}. Deadline:{" "}
                  {job.deadline || "Check original listing"}.
                </p>
                {job.url && (
                  <a
                    className="text-link"
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on {job.source || "original source"} ↗
                  </a>
                )}
              </article>
            ))
          }
        </CatalogCollection>
      </main>
    </div>
  );
}
