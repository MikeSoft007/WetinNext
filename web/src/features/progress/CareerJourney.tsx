import { useEffect, useState } from "react";
import { api } from "../../shared/api";
import { navigateApp } from "../../app/useSectionRoute";
import type { State } from "../../shared/types";
type Journal = {
  total: number;
  notice: string;
  items: {
    kind: string;
    title: string;
    at: string;
    status: string;
    target: string;
  }[];
};
export default function CareerJourney({ state }: { state: State | null }) {
  const [data, setData] = useState<Journal | null>(null),
    [page, setPage] = useState(1),
    [error, setError] = useState("");
  useEffect(() => setPage(1), [state?.goal_id]);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    if (state?.profile.goal)
      api<Journal>(`/me/journey?page=${page}`)
        .then((result) => {
          if (active && Array.isArray(result.items)) setData(result);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [state, page]);
  return (
    <section className="career-journey">
      <header>
        <span className="public-eyebrow">PROGRESS YOU CAN REVISIT</span>
        <h2>Your career journey</h2>
      </header>
      {error && <p role="alert">{error}</p>}
      {data && !data.items.length && (
        <p>
          Your learning actions, saved work, practice checks and experience
          reviews will appear here.
        </p>
      )}
      <ol>
        {data?.items.map((event, index) => (
          <li key={`${event.kind}-${event.at}-${index}`}>
            <span className="journey-event-dot" aria-hidden="true" />
            <div>
              <small>
                {event.kind.replace("-", " ")} ·{" "}
                {event.at
                  ? new Date(event.at).toLocaleDateString()
                  : "Date not recorded"}
              </small>
              <button
                className="text-link"
                onClick={() => navigateApp(event.target)}
              >
                {event.title}
              </button>
              <p>{event.status}</p>
            </div>
          </li>
        ))}
      </ol>
      {data && (
        <>
          <small>{data.notice}</small>
          {data.total > 10 && (
            <div className="career-bank-pagination">
              <button
                className="secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>Page {page}</span>
              <button
                className="secondary"
                disabled={page * 10 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
