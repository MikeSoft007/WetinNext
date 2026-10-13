import { useState } from "react";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { api } from "../../shared/api";
import type { Resource } from "../../shared/types";
import ResourceCard from "./ResourceCard";
import ProcessingProgress from "../../shared/ui/ProcessingProgress";
type Review = {
  supported: string[];
  gaps: string[];
  actions: string[];
  resources: Resource[];
  notice: string;
  url: string;
};
export default function LinkedInBridge({
  goal,
  market,
}: {
  goal: string;
  market: string;
}) {
  const [url, setUrl] = useState(""),
    [description, setDescription] = useState(""),
    [result, setResult] = useState<Review | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const search = new URL("https://www.linkedin.com/jobs/search/");
  search.searchParams.set("keywords", goal || "Internship");
  if (market !== "Global") search.searchParams.set("location", market);
  return (
    <section className="linkedin-bridge">
      <div className="linkedin-heading">
        <div>
          <span className="eyebrow">LOOK FURTHER</span>
          <h2>LinkedIn opportunities</h2>
        </div>
        <a
          className="text-link"
          href={search.toString()}
          target="_blank"
          rel="noreferrer"
        >
          Search {market === "Global" ? "worldwide" : market}
          <ArrowUpRight size={15} />
        </a>
      </div>
      <details>
        <summary>Check a job against my skills</summary>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            setResult(null);
            try {
              setResult(
                await api<Review>("/me/external-job-review", {
                  method: "POST",
                  body: JSON.stringify({ url, description }),
                }),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
            <label>
              LinkedIn job link
              <input
                type="url"
                required
                maxLength={1000}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.linkedin.com/jobs/view/…"
              />
            </label>
            <label>
              Paste the job description
              <textarea
                required
                minLength={80}
                maxLength={20000}
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Responsibilities, required skills and eligibility…"
              />
            </label>
          </fieldset>
          <p className="privacy-note">
            We review the text you paste. We don’t fetch LinkedIn or verify the
            vacancy. This review isn’t saved.
          </p>
          <button className="primary" disabled={busy}>
            Check my next steps
            <ArrowRight size={15} />
          </button>
        </form>
        {busy && (
          <ProcessingProgress
            label="Reviewing this job"
            detail="Comparing the description with your declared skills and latest CV review."
          />
        )}
        {error && (
          <p role="alert" className="auth-error">
            {error}
          </p>
        )}
        {result && (
          <div className="external-review" aria-live="polite">
            <div className="external-skill-columns">
              <div>
                <h3>Skills mentioned in your profile or CV</h3>
                <p>
                  {result.supported.join(" · ") ||
                    "No matching skill mentions yet."}
                </p>
              </div>
              <div>
                <h3>Evidence to clarify</h3>
                <p>
                  {result.gaps.join(" · ") ||
                    "Check the full requirements with the employer."}
                </p>
              </div>
            </div>
            <h3>Before you apply</h3>
            <ul>
              {result.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
            {result.resources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
            <p className="privacy-note">{result.notice}</p>
            <a
              className="text-link"
              href={result.url}
              target="_blank"
              rel="noreferrer"
            >
              Check original listing
              <ArrowUpRight size={15} />
            </a>
          </div>
        )}
      </details>
    </section>
  );
}
