import { ArrowUpRight, BookOpen, Clock3, Wifi } from "lucide-react";
import type { Resource } from "../../shared/types";
export function ResourceDetails({ resource }: { resource: Resource }) {
  return (
    <>
      <span
        className={`resource-format ${resource.low_data_suitable ? "text-first" : ""}`}
      >
        <Wifi size={12} />
        {resource.data_usage === "text_first"
          ? "Text-first · lower data"
          : resource.data_usage === "video_heavy"
            ? "Video · more data"
            : resource.data_usage === "mixed"
              ? "Mixed media"
              : "Data use unverified"}
      </span>
      <details className="resource-details">
        <summary>Make this resource useful</summary>
        <p>
          {resource.data_note ||
            "Check media size and tool requirements on the provider site."}
        </p>
        <h4>Try a {resource.suggested_session_minutes || 20}-minute session</h4>
        <p>
          {resource.sample_exercise ||
            "Complete one introductory activity and explain what you learned."}
        </p>
        {!!resource.learning_outcomes?.length && (
          <>
            <h4>What to practise</h4>
            <ul>
              {resource.learning_outcomes.map((outcome) => (
                <li key={outcome}>{outcome}</li>
              ))}
            </ul>
          </>
        )}
        <p>{resource.prerequisites}</p>
        <p>{resource.review}</p>
        <p>
          {resource.cost} · {resource.device}
        </p>
      </details>
    </>
  );
}
export default function ResourceCard({ resource }: { resource: Resource }) {
  return (
    <article className="card opportunity-card resource-card">
      <div className="resource-provider">
        <span className="flow-orbit-icon">
          <BookOpen size={18} />
        </span>
        <span className="eyebrow">{resource.provider}</span>
      </div>
      <h3>{resource.title}</h3>
      <p>
        <span className="response-cost-tag">
          {/^free\b/i.test(resource.cost)
            ? "Free"
            : /^paid\b/i.test(resource.cost)
              ? "Paid"
              : "Check cost"}
        </span>
        {resource.format}
      </p>
      <ResourceDetails resource={resource} />
      <div className="resource-card-footer">
        <span>
          <Clock3 size={13} />
          Start with {resource.suggested_session_minutes || 20} min
        </span>
        <a
          className="text-link"
          href={resource.url}
          target="_blank"
          rel="noreferrer"
        >
          Open resource
          <ArrowUpRight size={14} />
        </a>
      </div>
    </article>
  );
}
