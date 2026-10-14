import { LocalCollection } from "../../shared/ui/Collection";
import { navigateApp } from "../../app/useSectionRoute";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  ClipboardCheck,
  SlidersHorizontal,
  Sparkles,
  BookOpen,
  RotateCcw,
  Timer,
} from "lucide-react";
import { api } from "../../shared/api";
import type { State } from "../../shared/types";
import ProcessingProgress from "../../shared/ui/ProcessingProgress";
type Readiness = {
  goal: string;
  practice: { correct: number; total: number } | null;
  cv_reviewed: boolean;
  evidence_count: number;
  qualification_status: string;
  eligibility_status: string;
  notice: string;
};
type Difficulty = "beginner" | "intermediate" | "advanced";
type Attempt = {
  expires_at?: string | null;
  time_limit_minutes?: number;
  id: string;
  title: string;
  question_count?: number;
  difficulty?: Difficulty;
  questions: { prompt: string; options: string[] }[];
  completed: boolean;
  result?: {
    unanswered?: number;
    time_expired?: boolean;
    correct: number;
    total: number;
    notice: string;
    feedback: {
      selected_answer?: string | null;
      selected_index?: number | null;
      correct_index?: number;
      correct: boolean;
      answer: string;
      explanation: string;
      source: { url: string; title: string; specific_reference?: boolean };
    }[];
  };
};
function lessonLink(source: {
  url: string;
  title: string;
  specific_reference?: boolean;
}) {
  try {
    const url = new URL(source.url);
    for (const key of Array.from(url.searchParams.keys()))
      if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
    if (
      url.protocol !== "https:" ||
      ["index", "contents", "table-of-contents", "preface"].includes(
        url.pathname.replace(/\/$/, "").split("/").pop() || "",
      ) ||
      !url.pathname.replace(/\//g, "") ||
      /^\/(subjects|search|catalog|categories)(\/|$)/i.test(url.pathname)
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}
const levels = [
  { id: "beginner", title: "Beginner", note: "Recognise the essentials" },
  { id: "intermediate", title: "Intermediate", note: "Apply what you know" },
  { id: "advanced", title: "Advanced", note: "Reason through scenarios" },
] as const;
export default function ReadinessCheck({
  state,
  onUpdated,
}: {
  state: State | null;
  onUpdated?: () => Promise<void>;
}) {
  const [flagged, setFlagged] = useState<number[]>([]);
  const [summary, setSummary] = useState<Readiness | null>(null),
    [attempt, setAttempt] = useState<Attempt | null>(null),
    [answers, setAnswers] = useState<Record<number, number>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [count, setCount] = useState(4),
    [difficulty, setDifficulty] = useState<Difficulty>("beginner"),
    [current, setCurrent] = useState(0),
    [configure, setConfigure] = useState(false),
    [confirm, setConfirm] = useState(false),
    [minutes, setMinutes] = useState(10),
    [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => setFlagged([]), [attempt?.id]);
  useEffect(() => {
    if (!state) return;
    let active = true;
    setError("");
    setSummary(null);
    setAttempt(null);
    setAnswers({});
    setCurrent(0);
    setConfigure(false);
    setConfirm(false);
    Promise.all([
      api<Readiness>("/me/readiness"),
      api<Attempt | null>("/me/assessment"),
    ])
      .then(([s, a]) => {
        if (active) {
          setSummary(s);
          setAttempt(a);
          if (a) {
            setCount(a.questions.length);
            setDifficulty(a.difficulty || "beginner");
            setMinutes(a.time_limit_minutes || 0);
          }
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Your practice could not load. Please refresh to reconnect.",
          );
      });
    return () => {
      active = false;
    };
  }, [state]);
  useEffect(() => {
    if (location.hash === "#practice-check")
      document
        .getElementById("practice-check")
        ?.scrollIntoView?.({ behavior: "smooth" });
  }, []);
  async function start() {
    if (!Number.isInteger(count) || count < 1 || count > 20) return;
    setBusy(true);
    setError("");
    try {
      const next = await api<Attempt>("/me/assessment", {
        method: "POST",
        body: JSON.stringify({
          question_count: count,
          difficulty,
          time_limit_minutes: minutes,
        }),
      });
      setAttempt(next);
      setAnswers({});
      setCurrent(0);
      setConfigure(false);
      setConfirm(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!attempt) return;
    setBusy(true);
    setError("");
    try {
      setAttempt(
        await api<Attempt>(`/me/assessment/${attempt.id}/submit`, {
          method: "POST",
          body: JSON.stringify({
            answers: attempt.questions.map((_, i) => answers[i] ?? null),
          }),
        }),
      );
      setSummary(await api<Readiness>("/me/readiness"));
      await onUpdated?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!attempt?.expires_at || attempt.completed) {
      setRemaining(null);
      return;
    }
    const update = () =>
      setRemaining(
        Math.max(
          0,
          Math.ceil((Date.parse(attempt.expires_at!) - Date.now()) / 1000),
        ),
      );
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [attempt?.id, attempt?.expires_at, attempt?.completed]);
  const expired = remaining === 0;
  const question = attempt?.questions[current],
    total = attempt?.questions.length || 0,
    answered = Object.keys(answers).length,
    showSetup = !attempt || configure;
  return (
    <section id="practice-check" className="readiness-check quiz-studio">
      <header className="quiz-heading">
        <div>
          <span className="eyebrow">
            <Sparkles size={13} /> A LITTLE PRACTICE. A CLEARER NEXT STEP.
          </span>
          <h2>Your next-step check</h2>
          <p>
            Explore what you know and what to revisit for{" "}
            {state?.profile.goal || "your goal"}.
          </p>
        </div>
        <span className="quiz-emblem" aria-hidden="true">
          <ClipboardCheck size={30} strokeWidth={1.3} />
        </span>
      </header>
      <div className="readiness-signals">
        <div>
          <strong>
            {summary?.practice
              ? `${summary.practice.correct}/${summary.practice.total}`
              : summary
                ? "Ready when you are"
                : "Loading…"}
          </strong>
          <span>Latest practice result</span>
        </div>
        <div>
          <strong>{summary?.evidence_count || 0}</strong>
          <span>Saved work examples</span>
        </div>
        <div>
          <strong>{summary?.cv_reviewed ? "Reviewed" : "Not reviewed"}</strong>
          <span>CV for this goal</span>
        </div>
      </div>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      {busy && (
        <ProcessingProgress
          label="Preparing your practice check"
          detail="Creating or saving goal-specific questions and feedback."
        />
      )}
      {showSetup && !busy && (
        <div className="quiz-setup">
          <div className="quiz-setup-heading">
            <SlidersHorizontal size={18} />
            <div>
              <span className="public-eyebrow">
                DESIGN YOUR PRACTICE SESSION
              </span>
              <h3>Choose your challenge</h3>
              <p>
                Set the size, pace and difficulty. You’ll get answer
                explanations and linked lessons.
              </p>
            </div>
          </div>
          <label className="quiz-count">
            Number of questions
            <input
              aria-label="Number of questions"
              type="number"
              min={1}
              max={20}
              step={1}
              value={Number.isNaN(count) ? "" : count}
              onChange={(e) => setCount(e.target.valueAsNumber)}
            />
            <small>Choose 1–20 per set</small>
          </label>
          <label className="quiz-timer-setting">
            <Timer size={17} />
            Time limit
            <select
              aria-label="Time limit"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            >
              {[0, 5, 10, 15, 20, 30, 45, 60].map((n) => (
                <option key={n} value={n}>
                  {n ? `${n} minutes` : "Untimed"}
                </option>
              ))}
            </select>
            <small>
              When time ends, answers lock. Submit to see your feedback.
            </small>
          </label>
          <div className="quiz-presets">
            {[4, 8, 12, 20].map((n) => (
              <button
                type="button"
                key={n}
                aria-pressed={count === n}
                onClick={() => setCount(n)}
              >
                {n} questions
              </button>
            ))}
          </div>
          <fieldset className="quiz-difficulty">
            <legend>Difficulty</legend>
            {levels.map((level) => (
              <label
                className={difficulty === level.id ? "selected" : ""}
                key={level.id}
              >
                <input
                  type="radio"
                  name="quiz-difficulty"
                  value={level.id}
                  checked={difficulty === level.id}
                  onChange={() => setDifficulty(level.id)}
                />
                <span>
                  <strong>{level.title}</strong>
                  <small>{level.note}</small>
                </span>
                {difficulty === level.id && <Check size={16} />}
              </label>
            ))}
          </fieldset>
          <div
            className="quiz-session-preview"
            aria-label="Practice session summary"
          >
            <strong>{Number.isInteger(count) ? count : "—"} questions</strong>
            <span>
              {levels.find((level) => level.id === difficulty)?.title}
            </span>
            <span>{minutes ? `${minutes} minutes` : "No timer"}</span>
          </div>
          <div className="quiz-setup-actions">
            <button
              className="primary"
              disabled={!Number.isInteger(count) || count < 1 || count > 20}
              onClick={() =>
                state?.plan?.research_id
                  ? void start()
                  : navigateApp("/app/discover?view=plan")
              }
            >
              <ClipboardCheck size={16} />
              {state?.plan?.research_id
                ? `Start ${Number.isFinite(count) ? count : ""}-question practice`
                : "Build my researched plan"}
              <ArrowRight size={15} />
            </button>
            {attempt && (
              <button className="text-link" onClick={() => setConfigure(false)}>
                Return to my current set
              </button>
            )}
          </div>
          {!state?.plan?.research_id && (
            <p className="privacy-note">
              A researched plan keeps practice questions grounded in your chosen
              goal.
            </p>
          )}
        </div>
      )}
      {attempt && !attempt.completed && !showSetup && question && (
        <div className="quiz-player">
          <div className="quiz-player-bar">
            <span>
              {attempt.difficulty || "beginner"} · {total} questions
            </span>
            <span
              className={`quiz-clock ${remaining !== null && remaining < 60 ? "urgent" : ""}`}
              role="timer"
              aria-label="Time remaining"
            >
              <Timer size={15} />
              {remaining === null
                ? "Untimed"
                : `${Math.floor(remaining / 60)
                    .toString()
                    .padStart(
                      2,
                      "0",
                    )}:${(remaining % 60).toString().padStart(2, "0")}`}
            </span>
            <button
              className="text-link"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              <SlidersHorizontal size={14} />
              Change setup
            </button>
          </div>
          {confirm && (
            <div className="research-replace" role="status">
              <p>
                Change the set? Answers entered here will be cleared when you
                start another set.
              </p>
              <button
                className="secondary"
                onClick={() => {
                  setConfigure(true);
                  setConfirm(false);
                }}
              >
                Change question count or difficulty
              </button>
              <button className="text-link" onClick={() => setConfirm(false)}>
                Keep practising
              </button>
            </div>
          )}
          <div className="quiz-progress-label">
            <strong>
              Question {current + 1} of {total}
            </strong>
            <span>
              {answered}/{total} answered
            </span>
          </div>
          <div
            className="quiz-answer-progress"
            role="progressbar"
            aria-label="Questions answered"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={answered}
          >
            <span style={{ width: `${(answered / total) * 100}%` }} />
          </div>
          <h3 className="quiz-set-title">{attempt.title}</h3>
          <div className="quiz-review-tools">
            <button
              className="text-link"
              aria-pressed={flagged.includes(current)}
              onClick={() =>
                setFlagged((items) =>
                  items.includes(current)
                    ? items.filter((item) => item !== current)
                    : [...items, current],
                )
              }
            >
              {flagged.includes(current)
                ? "Marked for review"
                : "Mark for review"}
            </button>
            {flagged.length > 0 && (
              <button
                className="text-link"
                onClick={() => setCurrent(flagged[0])}
              >
                Review marked · {flagged.length}
              </button>
            )}
          </div>
          <fieldset className="quiz-question" disabled={busy || expired}>
            <legend>
              {current + 1}. {question.prompt}
            </legend>
            {question.options.map((option, index) => (
              <label
                className={answers[current] === index ? "chosen" : ""}
                key={index}
              >
                <input
                  type="radio"
                  name={`question-${current}`}
                  checked={answers[current] === index}
                  onChange={() => setAnswers({ ...answers, [current]: index })}
                />
                <span className="quiz-option-letter">{"ABCD"[index]}</span>
                <span>{option}</span>
                {answers[current] === index && <Check size={17} />}
              </label>
            ))}
          </fieldset>
          <nav className="quiz-question-nav" aria-label="Question navigation">
            {attempt.questions.map((_, index) => (
              <button
                type="button"
                aria-label={`Go to question ${index + 1}${answers[index] !== undefined ? ", answered" : ""}`}
                aria-current={current === index ? "step" : undefined}
                className={`${answers[index] !== undefined ? "answered" : ""} ${flagged.includes(index) ? "flagged" : ""}`}
                title={
                  flagged.includes(index) ? "Marked for review" : undefined
                }
                onClick={() => setCurrent(index)}
                key={index}
              >
                {index + 1}
              </button>
            ))}
          </nav>
          <div className="quiz-player-actions">
            <button
              className="text-link"
              disabled={busy || current === 0}
              onClick={() => setCurrent(current - 1)}
            >
              <ArrowLeft size={15} />
              Back
            </button>
            {current < total - 1 && !expired ? (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setCurrent(current + 1)}
              >
                Next question
                <ArrowRight size={15} />
              </button>
            ) : (
              <button
                className="primary"
                disabled={busy || (!expired && answered !== total)}
                onClick={() => void submit()}
              >
                Check my answers
                <Check size={15} />
              </button>
            )}
          </div>
          {expired && (
            <p role="status" className="quiz-time-up">
              Time’s up. Your answers are locked. Submit your attempt;
              unanswered questions count as incorrect.
            </p>
          )}
          {!expired && current === total - 1 && answered < total && (
            <p className="privacy-note">
              Answer the remaining {total - answered} questions before checking
              your results.
            </p>
          )}
        </div>
      )}
      {attempt?.result && !showSetup && (
        <div className="quiz-results">
          <div className="quiz-result-heading">
            <div className="quiz-score">
              <span>
                <strong>
                  {attempt.result.correct}
                  <small>/{attempt.result.total}</small>
                </strong>
                <small>correct</small>
              </span>
            </div>
            <div>
              <span className="eyebrow">YOUR PRACTICE SNAPSHOT</span>
              <h3>
                {attempt.result.correct} of {attempt.result.total} correct ·
                Practice only
              </h3>
              <p>
                {attempt.result.correct === attempt.result.total
                  ? "A useful start. Keep applying these ideas in your weekly work."
                  : `${attempt.result.total - attempt.result.correct} concepts to revisit. Use the explanations and linked learning below.`}
              </p>
              <button className="text-link" onClick={() => setConfigure(true)}>
                <RotateCcw size={15} />
                Build another practice set
              </button>
            </div>
          </div>
          {attempt.result.time_expired && (
            <p className="privacy-note">
              Timed practice ended · {attempt.result.unanswered || 0} unanswered
            </p>
          )}
          <div className="practice-feedback">
            {
              <LocalCollection
                items={attempt.result.feedback.map((feedback, index) => ({
                  ...feedback,
                  index,
                }))}
                label="quiz explanations"
                pageSize={4}
                searchable={false}
              >
                {(visible) =>
                  visible.map(({ index, ...feedback }) => (
                    <details
                      key={index}
                      className={feedback.correct ? "correct" : "revisit"}
                      open={!feedback.correct}
                    >
                      <summary>
                        <span>
                          {feedback.correct ? (
                            <Check size={16} />
                          ) : (
                            <BookOpen size={16} />
                          )}
                        </span>
                        <div>
                          <small>
                            QUESTION {index + 1} ·{" "}
                            {feedback.correct ? "UNDERSTOOD" : "REVISIT"}
                          </small>
                          <strong>{attempt.questions[index]?.prompt}</strong>
                        </div>
                      </summary>
                      <div className="quiz-explanation">
                        <div className="quiz-answer-comparison">
                          <div
                            className={
                              feedback.correct
                                ? "answer-match"
                                : "answer-missed"
                            }
                          >
                            <small>YOUR ANSWER</small>
                            <strong>
                              {feedback.selected_answer === null
                                ? "Not answered"
                                : (feedback.selected_answer ??
                                  "Not recorded in this older attempt")}
                            </strong>
                          </div>
                          <div className="answer-match">
                            <small>CORRECT ANSWER</small>
                            <strong>{feedback.answer}</strong>
                          </div>
                        </div>
                        <p>{feedback.explanation}</p>
                        {lessonLink(feedback.source) ? (
                          <a
                            className="quiz-lesson-link"
                            href={lessonLink(feedback.source)!}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <BookOpen size={16} />
                            <span>
                              <strong>{feedback.source.title}</strong>
                              <small>
                                {feedback.source.specific_reference
                                  ? "Referenced lesson"
                                  : "Original plan resource · lesson reference not recorded"}
                              </small>
                            </span>
                            <ArrowRight size={15} />
                          </a>
                        ) : (
                          <small className="privacy-note">
                            This older attempt has no specific lesson reference.
                            Create a new practice set for cited lessons.
                          </small>
                        )}
                      </div>
                    </details>
                  ))
                }
              </LocalCollection>
            }
          </div>
        </div>
      )}
      <p className="readiness-limits">
        Qualifications: {summary?.qualification_status || "Not verified"} ·
        Eligibility: {summary?.eligibility_status || "Check each opportunity"}
      </p>
      <details className="readiness-notice">
        <summary>What this check can tell you</summary>
        <p className="privacy-note">
          {summary?.notice ||
            "AI-generated practice is not a validated exam or proof of job readiness. Formal qualification, practical assessment and opportunity-specific eligibility still matter."}
        </p>
      </details>
    </section>
  );
}
