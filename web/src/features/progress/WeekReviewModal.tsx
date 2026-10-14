import { api } from "../../shared/api";
import { useEffect, useRef, useState } from "react";
import { X, ArrowUpRight } from "lucide-react";
import type { State, Week } from "../../shared/types";
import WeekWorkbench from "../learning/WeekWorkbench";
export default function WeekReviewModal({
  state,
  week,
  onClose,
  onComplete,
  onSaved,
}: {
  state: State;
  week: Week;
  onClose: () => void;
  onComplete: (week: number) => Promise<void>;
  onSaved: () => void;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [aiReview, setAIReview] = useState<{
    assessment: string;
    next_action: string;
    notice: string;
  } | null>(null);
  const dialog = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const elements = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),summary",
          ) ?? [],
        ).filter((item) => item.getClientRects().length > 0);
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  const source = state.plan?.resources?.find(
    (item) => item.id === week.resource_id,
  );
  const status = state.progress[String(week.week)]?.status;
  const next = state.plan?.weeks.find(
    (item) => state.progress[String(item.week)]?.status !== "done",
  );
  async function complete() {
    setBusy(true);
    try {
      await onComplete(week.week);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="week-review-title"
        className="week-review-modal"
      >
        <header>
          <div>
            <span className="public-eyebrow">
              WEEK {week.week} ·{" "}
              {status === "done"
                ? "COMPLETED"
                : next?.week === week.week
                  ? "CURRENT FOCUS"
                  : "PREVIEW"}
            </span>
            <h2 id="week-review-title">{week.title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close week review"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="week-review-content">
          <p className="week-topic-description">
            {week.description ||
              source?.review ||
              `Explore ${week.title.toLowerCase()} using the linked learning source, then apply it in the task below.`}
          </p>
          {!!week.learning_objectives?.length && (
            <>
              <h3>What you’ll learn</h3>
              <ul>
                {week.learning_objectives.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}
          <h3>Your study approach</h3>
          <p>
            {week.resource_guidance ||
              `Allow ${week.minutes} minutes. Learn one useful idea, try an example and save your evidence.`}
          </p>
          {source && (
            <div className="week-review-source">
              <span className="response-cost-tag">
                {/^free\b/i.test(source.cost) ? "Free" : "Check cost"}
              </span>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title}
                <ArrowUpRight size={14} />
              </a>
              <small>
                {source.provider} · {source.format} · {source.cost}
              </small>
            </div>
          )}
          <h3>Practice task</h3>
          <p>{week.task}</p>
          <p>
            <strong>Completion checkpoint:</strong> {week.success}
          </p>
          <WeekWorkbench
            week={week}
            planId={state.plan?.id}
            status={status}
            compactResponse
            showSource={!source}
            readOnly={status === "done" || next?.week !== week.week}
            onSaved={onSaved}
          />
          {next?.week === week.week && (
            <div className="week-ai-review">
              <button
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    setAIReview(
                      await api("/pathway/branch-review", {
                        method: "POST",
                        body: JSON.stringify({ week: week.week }),
                      }),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Review my saved work with AI
              </button>
              <small>
                This shares this week’s saved notes and actions for feedback.
              </small>
              {aiReview && (
                <section aria-live="polite">
                  <p>{aiReview.assessment}</p>
                  <strong>{aiReview.next_action}</strong>
                  <p>{aiReview.notice}</p>
                </section>
              )}
            </div>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
        <footer>
          <button className="secondary" onClick={onClose}>
            Close
          </button>
          {next?.week === week.week && (
            <button
              className="primary"
              disabled={busy}
              onClick={() => void complete()}
            >
              {busy ? "Saving…" : "Complete week"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
