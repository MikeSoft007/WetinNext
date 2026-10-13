import { LocalCollection } from "../../shared/ui/Collection";
import { useEffect, useState } from "react";
import { api } from "../../shared/api";
import type { Opportunity } from "../../shared/types";
export type Journal = {
  opportunity_id: string;
  opportunity?: Partial<Opportunity>;
  status?: string;
  checklist: Record<string, boolean>;
  notes: string;
  history: { status: string; at: string }[];
  updated_at?: string;
};
const stages = [
  "interested",
  "preparing",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "closed",
  "withdrawn",
];
export function ApplicationEditor({
  record,
  onSaved,
}: {
  record: Journal;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(record.status || "interested"),
    [notes, setNotes] = useState(record.notes || ""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    setStatus(record.status || "interested");
    setNotes(record.notes || "");
    setMessage("");
  }, [record]);
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await api(`/applications/${record.opportunity_id}`, {
        method: "PUT",
        body: JSON.stringify({ status, notes }),
      });
      onSaved();
      setMessage("Saved.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="application-editor">
      {record.opportunity?.availability === "closed" && (
        <p className="notice">
          This listing is closed or no longer published. Your preparation and
          stage history are retained.
        </p>
      )}
      <label>
        Application stage
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {stages
            .filter(
              (stage) =>
                !record.opportunity?.sample ||
                !["applied", "interviewing", "offer", "rejected"].includes(
                  stage,
                ),
            )
            .map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
        </select>
      </label>
      <label>
        Private notes <span>(optional)</span>
        <textarea
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Your next action or an update from the employer"
        />
      </label>
      <button className="secondary" disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save update"}
      </button>
      {message && <p role="status">{message}</p>}
      {!!record.history.length && (
        <details>
          <summary>Stage history</summary>
          {record.history
            .slice()
            .reverse()
            .map((event, i) => (
              <p key={i}>
                {event.status} · {new Date(event.at).toLocaleDateString()}
              </p>
            ))}
        </details>
      )}
      <p className="subtle">
        This is your personal tracker. Saving a stage does not send an
        application. Notes and checklist ticks are excluded from AI requests.
      </p>
    </div>
  );
}
export default function OpportunityJournal({
  onReview,
  refreshToken,
}: {
  onReview: (id: string) => void;
  refreshToken: unknown;
}) {
  const [records, setRecords] = useState<Journal[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  async function load() {
    try {
      setRecords(await api<Journal[]>("/applications"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [refreshToken]);
  return (
    <section className="card application-tracker">
      <h2>Saved opportunities</h2>
      {loading ? (
        <p>Loading your tracker…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !records.length ? (
        <p>
          Save an opportunity or start its preparation checklist to track it
          here.
        </p>
      ) : (
        <LocalCollection items={records} label="saved opportunities">
          {(visible) =>
            visible.map((record) => (
              <article
                className="tracked-opportunity"
                key={record.opportunity_id}
              >
                <h3>{record.opportunity?.title || record.opportunity_id}</h3>
                <p>
                  {record.opportunity?.organisation} ·{" "}
                  {Object.values(record.checklist).filter(Boolean).length}{" "}
                  preparation actions complete
                </p>
                <button
                  className="text-link"
                  onClick={() => onReview(record.opportunity_id)}
                >
                  View preparation ↗
                </button>
                <details>
                  <summary>Update application</summary>
                  <ApplicationEditor record={record} onSaved={load} />
                </details>
              </article>
            ))
          }
        </LocalCollection>
      )}
    </section>
  );
}
