import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Flag,
  LockKeyhole,
  LoaderCircle,
  Medal,
  Puzzle,
  Sprout,
  Target,
  Zap,
} from "lucide-react";
import { navigateApp } from "../../app/useSectionRoute";
import { api } from "../../shared/api";
import { isDirectSource } from "../../shared/sourceLinks";
import type { Resource, State, Week } from "../../shared/types";
import LearningBranches from "./LearningBranches";
import WeekWorkbench from "../learning/WeekWorkbench";

type PortfolioEntry = {
  week: number;
  checklist: Record<string, boolean>;
  evidence_url: string;
  reflection: string;
  learning_note?: string;
  practice_example?: string;
  open_question?: string;
};
type Readiness = {
  practice: { correct: number; total: number } | null;
  cv_reviewed: boolean;
  evidence_count: number;
};
type CVReview = { goal: string; skills?: string[] };
type PracticeAttempt = {
  completed: boolean;
  result?: {
    correct: number;
    total: number;
    feedback: {
      correct: boolean;
      source?: { skills?: string[] };
    }[];
  };
};
type BranchReview = {
  recommendation: "advance" | "research";
  assessment: string;
  evidence_reviewed: string[];
  next_action: string;
  resources: { resource: Resource; reason: string }[];
  notice: string;
};

const XP_PER_ACTION = 10;
const XP_FOR_EVIDENCE = 25;
const XP_FOR_WEEK = 20;

export default function CareerPathTree({
  state,
  refreshToken = 0,
  onComplete,
  onWorkSaved,
  onRecovery,
}: {
  state: State;
  refreshToken?: number;
  onComplete: (week: number) => Promise<void>;
  onWorkSaved?: () => void;
  onRecovery?: (week: number, status: "stuck" | "more-time") => Promise<void>;
}) {
  const [portfolio, setPortfolio] = useState<PortfolioEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [cvReviews, setCVReviews] = useState<CVReview[]>([]);
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null);
  const [signalsError, setSignalsError] = useState("");
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const [reviewingWeek, setReviewingWeek] = useState<number | null>(null);
  const [review, setReview] = useState<BranchReview | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [completionError, setCompletionError] = useState("");
  const [completingWeek, setCompletingWeek] = useState<number | null>(null);
  const plan = state.plan;

  useEffect(() => {
    setOpenWeek(null);
    setReview(null);
    setReviewError("");
    setCompletionError("");
  }, [plan?.id]);

  useEffect(() => {
    let active = true;
    if (!plan) {
      setPortfolio([]);
      setLoading(false);
      setError("");
      return () => {
        active = false;
      };
    }
    setLoading(true);
    setError("");
    api<PortfolioEntry[]>("/me/portfolio")
      .then((data) => {
        if (!Array.isArray(data))
          throw new Error("Saved learning evidence was not returned.");
        if (active) setPortfolio(data);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [plan?.id, refreshToken, state.progress]);

  useEffect(() => {
    let active = true;
    if (!plan) {
      setReadiness(null);
      setCVReviews([]);
      setAttempt(null);
      setSignalsError("");
      return () => {
        active = false;
      };
    }
    setReadiness(null);
    setCVReviews([]);
    setAttempt(null);
    setSignalsError("");
    Promise.all([
      api<Readiness>("/me/readiness"),
      api<CVReview[]>("/me/cv-reviews"),
      api<PracticeAttempt | null>("/me/assessment"),
    ])
      .then(([summary, reviews, practice]) => {
        if (!Array.isArray(reviews))
          throw new Error("CV review records were not returned.");
        if (active) {
          setReadiness(summary);
          setCVReviews(reviews);
          setAttempt(practice);
        }
      })
      .catch((e) => {
        if (active)
          setSignalsError(
            `Opportunity preparation signals could not load: ${(e as Error).message}`,
          );
      });
    return () => {
      active = false;
    };
  }, [plan?.id, refreshToken, state.progress]);

  const entryByWeek = useMemo(
    () => new Map(portfolio.map((entry) => [entry.week, entry])),
    [portfolio],
  );
  const weeks = plan?.weeks ?? [];
  const pointsByWeek = useMemo(
    () =>
      weeks.map((week) => {
        const entry = entryByWeek.get(week.week);
        const actions = Object.values(entry?.checklist ?? {}).filter(
          Boolean,
        ).length;
        const hasEvidence = Boolean(
          entry?.learning_note?.trim() ||
            entry?.reflection?.trim() ||
            entry?.practice_example?.trim() ||
            entry?.evidence_url?.trim(),
        );
        const checkedIn = state.progress[String(week.week)]?.status === "done";
        return (
          actions * XP_PER_ACTION +
          (hasEvidence ? XP_FOR_EVIDENCE : 0) +
          (checkedIn ? XP_FOR_WEEK : 0)
        );
      }),
    [entryByWeek, state.progress, weeks],
  );
  const earned = pointsByWeek.reduce((total, points) => total + points, 0);
  const currentIndex = weeks.findIndex(
    (week) => state.progress[String(week.week)]?.status !== "done",
  );
  const nextIndex = currentIndex === -1 ? weeks.length : currentIndex;
  const completeCount = weeks.filter(
    (week) => state.progress[String(week.week)]?.status === "done",
  ).length;
  const guide = plan?.research_guide;
  const trainingRoutes = (guide?.places ?? []).filter((place) =>
    isDirectSource(place.url),
  );
  const opportunityRoutes = (guide?.opportunities ?? []).filter((opportunity) =>
    isDirectSource(opportunity.url),
  );
  const currentCVReview = cvReviews.find(
    (review) => review.goal === state.profile.goal,
  );
  const cvReviewedForGoal = Boolean(currentCVReview || readiness?.cv_reviewed);
  const quizComplete = Boolean(attempt?.completed && attempt.result);
  const workEvidenceCount = Math.max(
    portfolio.filter(
      (entry) =>
        entry.learning_note?.trim() ||
        entry.reflection?.trim() ||
        entry.practice_example?.trim() ||
        entry.evidence_url?.trim(),
    ).length,
    readiness?.evidence_count ?? 0,
  );
  const prepSignals = [quizComplete, cvReviewedForGoal, workEvidenceCount > 0];
  const readyForPrepQuest = prepSignals.every(Boolean);
  const cvSkillNames = currentCVReview?.skills ?? [];
  const quizSkillNames =
    attempt?.result?.feedback
      .filter((item) => item.correct)
      .flatMap((item) => item.source?.skills ?? []) ?? [];
  const workSkillNames = portfolio.flatMap((entry) => {
    const hasSavedWork = Boolean(
      entry.learning_note?.trim() ||
        entry.reflection?.trim() ||
        entry.practice_example?.trim() ||
        entry.evidence_url?.trim(),
    );
    if (!hasSavedWork) return [];
    const week = weeks.find((item) => item.week === entry.week);
    return (
      plan?.resources?.find((resource) => resource.id === week?.resource_id)
        ?.skills ?? []
    );
  });
  function skillKey(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9+#.]+/g, " ")
      .trim();
  }
  function skillSignals(skill: string) {
    const key = skillKey(skill);
    return {
      cv: cvSkillNames.some((item) => skillKey(item) === key),
      quiz: quizSkillNames.some((item) => skillKey(item) === key),
      work: workSkillNames.some((item) => skillKey(item) === key),
    };
  }
  async function reviewLevel(week: Week) {
    setReviewingWeek(week.week);
    setReview(null);
    setReviewError("");
    setCompletionError("");
    try {
      const result = await api<BranchReview>("/pathway/branch-review", {
        method: "POST",
        body: JSON.stringify({ week: week.week }),
      });
      setReview(result);
    } catch (e) {
      setReviewError((e as Error).message);
    } finally {
      setReviewingWeek(null);
    }
  }
  async function completeLevel(week: number) {
    setCompletingWeek(week);
    try {
      await onComplete(week);
      setReview(null);
      setCompletionError("");
    } catch (e) {
      setCompletionError((e as Error).message);
    } finally {
      setCompletingWeek(null);
    }
  }
  return (
    <section className="career-path-tree" aria-labelledby="career-path-title">
      <header className="career-tree-heading">
        <div className="career-tree-title">
          <span className="career-tree-mark" aria-hidden="true">
            <Sprout size={20} />
          </span>
          <div>
            <span className="public-eyebrow">YOUR CAREER DEVELOPMENT</span>
            <h2 id="career-path-title">Learning plan</h2>
          </div>
        </div>
        {plan && (
          <div className="career-xp" aria-label={`${earned} experience points`}>
            <Zap size={14} />
            <strong>{earned} XP</strong>
            <span>
              {completeCount}/{weeks.length} levels
            </span>
          </div>
        )}
      </header>

      {plan && (
        <div className="career-study-summary">
          <progress
            aria-label="Weeks completed"
            value={completeCount}
            max={Math.max(weeks.length, 1)}
          />
          <span>
            {completeCount} of {weeks.length} weeks complete
          </span>
          {weeks[nextIndex] && (
            <button
              className="text-link"
              onClick={() => {
                setOpenWeek(weeks[nextIndex].week);
                setReview(null);
                setReviewError("");
              }}
            >
              Continue week {weeks[nextIndex].week} <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}
      {!plan ? (
        <div className="career-tree-empty">
          <Target size={21} />
          <div>
            <strong>
              Your goal is the seed. Let’s map the first branches.
            </strong>
            <p>
              Build a researched starter plan to get goal-specific learning,
              practice and evidence steps in your tree.
            </p>
          </div>
          <button
            className="secondary"
            onClick={() => navigateApp("/app/discover?view=plan")}
          >
            Map my first steps <ArrowRight size={15} />
          </button>
        </div>
      ) : (
        <>
          {error && (
            <p className="career-tree-error" role="alert">
              Couldn’t load saved work: {error}
            </p>
          )}
          {loading && (
            <p className="career-tree-loading" role="status">
              Loading your quest…
            </p>
          )}
          <div
            className="career-tree-map"
            role="region"
            aria-label="Career path infographic"
          >
            <div className="career-tree-seed">
              <span>
                <Target size={15} />
              </span>
              <strong>{state.profile.goal || plan.title}</strong>
              <small>YOUR GOAL</small>
            </div>
            <ol className="career-tree-branches">
              {weeks.map((week, index) => {
                const entry = entryByWeek.get(week.week);
                const done =
                  state.progress[String(week.week)]?.status === "done";
                const active = !done && index === nextIndex;
                const locked = index > nextIndex;
                const actionCount = Object.values(
                  entry?.checklist ?? {},
                ).filter(Boolean).length;
                const hasProof = Boolean(
                  entry?.learning_note?.trim() ||
                    entry?.reflection?.trim() ||
                    entry?.practice_example?.trim() ||
                    entry?.evidence_url?.trim(),
                );
                const points =
                  actionCount * XP_PER_ACTION +
                  (hasProof ? XP_FOR_EVIDENCE : 0) +
                  (done ? XP_FOR_WEEK : 0);
                const BranchIcon = done
                  ? Check
                  : locked
                    ? LockKeyhole
                    : index === 0
                      ? BookOpen
                      : index === weeks.length - 1
                        ? Flag
                        : Puzzle;

                return (
                  <li
                    className={`career-branch ${done ? "is-done" : ""} ${active ? "is-active" : ""} ${locked ? "is-locked" : ""}`}
                    key={week.week}
                    aria-current={active ? "step" : undefined}
                  >
                    <span className="career-branch-node" aria-hidden="true">
                      <BranchIcon size={15} />
                    </span>
                    <details
                      className="career-branch-frame"
                      open={openWeek === week.week}
                      onToggle={(event) => {
                        if (event.currentTarget.open) {
                          setOpenWeek(week.week);
                          setReview(null);
                          setReviewError("");
                        } else {
                          setOpenWeek((current) =>
                            current === week.week ? null : current,
                          );
                        }
                      }}
                    >
                      <summary className="career-branch-card">
                        <span className="career-branch-meta">
                          <span>WEEK {String(index + 1).padStart(2, "0")}</span>
                          <span>{points} XP</span>
                        </span>
                        <span
                          className="career-branch-title"
                          role="heading"
                          aria-level={3}
                        >
                          {week.title}
                        </span>
                        <span className="career-branch-summary-state">
                          {done
                            ? "Complete"
                            : active
                              ? "Next · tap to open"
                              : locked
                                ? "Tap to preview"
                                : "Ready"}
                        </span>
                      </summary>
                      <div className="career-branch-details">
                        {openWeek === week.week && (
                          <section
                            className="level-response-context"
                            aria-label={`Level ${week.week} learning and career context`}
                          >
                            <h3>About {week.title}</h3>
                            {(() => {
                              const resource = plan.resources?.find(
                                (item) => item.id === week.resource_id,
                              );
                              const description =
                                week.description || resource?.review;
                              const objectives = week.learning_objectives
                                ?.length
                                ? week.learning_objectives
                                : resource?.learning_outcomes;
                              return (
                                <>
                                  <div className="level-topic-description">
                                    {description ? (
                                      description
                                        .split(/\n+/)
                                        .filter(Boolean)
                                        .map((paragraph, index) => (
                                          <p key={index}>{paragraph}</p>
                                        ))
                                    ) : (
                                      <p>
                                        This level focuses on{" "}
                                        {week.title.toLowerCase()}. Use the
                                        linked learning source to explore the
                                        topic, then apply it in the task below.
                                      </p>
                                    )}
                                  </div>
                                  {!!objectives?.length && (
                                    <>
                                      <h4>What you’ll learn</h4>
                                      <ul>
                                        {objectives.slice(0, 5).map((item) => (
                                          <li key={item}>{item}</li>
                                        ))}
                                      </ul>
                                    </>
                                  )}
                                  <h4>How to study this level</h4>
                                  <p>
                                    {week.resource_guidance ||
                                      `Set aside ${week.minutes} minutes for this level. Start with the linked resource, try one example and keep a note of anything you cannot yet explain.`}
                                  </p>
                                  {resource?.prerequisites && (
                                    <p>
                                      <strong>Before you start:</strong>{" "}
                                      {resource.prerequisites}
                                    </p>
                                  )}
                                </>
                              );
                            })()}
                            <h4>Put it into practice</h4>
                            <p>{week.task}</p>
                            <p className="level-outcome">
                              <strong>Your checkpoint:</strong> {week.success}
                            </p>
                            {(() => {
                              const source = plan.resources?.find(
                                (resource) => resource.id === week.resource_id,
                              );
                              return source ? (
                                <div className="level-source">
                                  <span className="response-cost-tag">
                                    {/^free\b/i.test(source.cost)
                                      ? "Free"
                                      : /paid|tuition|fee|\$|₦|RWF/i.test(
                                            source.cost,
                                          )
                                        ? "Paid / mixed"
                                        : "Check cost"}
                                  </span>
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {source.title} <ArrowUpRight size={13} />
                                  </a>
                                  <small>
                                    {source.provider} · {source.format}
                                  </small>
                                  {week.description && <p>{source.review}</p>}
                                  <small>{source.cost}</small>
                                </div>
                              ) : null;
                            })()}
                            {(trainingRoutes.length > 0 ||
                              opportunityRoutes.length > 0) && (
                              <details className="level-career-context">
                                <summary>
                                  Schools & career routes for your goal
                                </summary>
                                {trainingRoutes.slice(0, 2).map((place) => (
                                  <div
                                    className="level-route-row"
                                    key={place.url}
                                  >
                                    <span className="response-cost-tag">
                                      {place.cost_note &&
                                      /\bfree\b/i.test(place.cost_note)
                                        ? "Free"
                                        : place.cost_note &&
                                            /[₦$]|\bRWF\s*\d|\d[\d,]*\s*(NGN|USD|RWF)/i.test(
                                              place.cost_note,
                                            )
                                          ? "Paid"
                                          : "Check cost"}
                                    </span>
                                    <a
                                      href={place.url}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {place.name} <ArrowUpRight size={13} />
                                    </a>
                                    <small>{place.location}</small>
                                    <p>{place.entry_route}</p>
                                    {place.cost_note && (
                                      <small className="response-cost-note">
                                        Cost: {place.cost_note}
                                      </small>
                                    )}
                                  </div>
                                ))}
                                {opportunityRoutes
                                  .slice(0, 2)
                                  .map((opportunity) => (
                                    <div
                                      className="level-route-row"
                                      key={opportunity.url}
                                    >
                                      <a
                                        href={opportunity.url}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        {opportunity.title}{" "}
                                        <ArrowUpRight size={13} />
                                      </a>
                                      <small>
                                        {opportunity.provider} ·{" "}
                                        {opportunity.location}
                                      </small>
                                      <p>{opportunity.eligibility}</p>
                                      <small>
                                        {opportunity.deadline_note} ·{" "}
                                        {opportunity.availability_note}
                                      </small>
                                    </div>
                                  ))}
                                <small>
                                  These routes relate to your goal. Finishing
                                  this level alone does not establish
                                  eligibility.
                                </small>
                              </details>
                            )}
                          </section>
                        )}

                        {openWeek === week.week && (
                          <WeekWorkbench
                            week={week}
                            planId={plan?.id}
                            status={state.progress[String(week.week)]?.status}
                            readOnly={locked || done}
                            compactResponse
                            showSource={
                              !plan.resources?.some(
                                (resource) => resource.id === week.resource_id,
                              )
                            }
                            onSaved={() => {
                              setReview(null);
                              setReviewError("");
                              setCompletionError("");
                              onWorkSaved?.();
                            }}
                          />
                        )}
                        {!done && active && (
                          <div className="career-level-review">
                            <p>
                              This sends your goal, level, checked actions,
                              saved note and relevant sources to AI.
                            </p>
                            {onRecovery && (
                              <div className="study-recovery">
                                <button
                                  className="text-link"
                                  disabled={completingWeek !== null}
                                  onClick={() => {
                                    setCompletingWeek(week.week);
                                    void onRecovery(week.week, "stuck")
                                      .catch((e) =>
                                        setCompletionError(
                                          (e as Error).message,
                                        ),
                                      )
                                      .finally(() => setCompletingWeek(null));
                                  }}
                                >
                                  I’m stuck
                                </button>
                                <button
                                  className="text-link"
                                  disabled={completingWeek !== null}
                                  onClick={() => {
                                    setCompletingWeek(week.week);
                                    void onRecovery(week.week, "more-time")
                                      .catch((e) =>
                                        setCompletionError(
                                          (e as Error).message,
                                        ),
                                      )
                                      .finally(() => setCompletingWeek(null));
                                  }}
                                >
                                  I need more time
                                </button>
                              </div>
                            )}
                            {state.progress[String(week.week)]?.advice && (
                              <p role="status">
                                {state.progress[String(week.week)].advice}
                              </p>
                            )}
                            <button
                              className="secondary"
                              disabled={reviewingWeek === week.week}
                              onClick={() => void reviewLevel(week)}
                            >
                              {reviewingWeek === week.week ? (
                                <LoaderCircle size={14} className="spin" />
                              ) : (
                                <Target size={14} />
                              )}
                              {reviewingWeek === week.week
                                ? "Reviewing this level…"
                                : "Ask AI to review this level"}
                            </button>
                          </div>
                        )}
                        {reviewError && openWeek === week.week && (
                          <div className="career-level-review-error">
                            <p className="career-tree-error" role="alert">
                              AI review unavailable: {reviewError} You can still
                              complete this level yourself.
                            </p>
                            {active && (
                              <button
                                className="secondary"
                                disabled={completingWeek === week.week}
                                onClick={() => void completeLevel(week.week)}
                              >
                                Complete without AI review
                                <ArrowRight size={14} />
                              </button>
                            )}
                          </div>
                        )}
                        {completionError && openWeek === week.week && (
                          <p className="career-tree-error" role="alert">
                            Couldn’t save this level: {completionError}
                          </p>
                        )}
                        {review && openWeek === week.week && (
                          <section
                            className={`career-level-feedback is-${review.recommendation}`}
                            aria-live="polite"
                          >
                            <span className="public-eyebrow">
                              AI LEVEL CHECK ·{" "}
                              {review.recommendation === "advance"
                                ? "READY FOR NEXT LEVEL"
                                : "ONE MORE STEP"}
                            </span>
                            <p>{review.assessment}</p>
                            {review.evidence_reviewed.length > 0 && (
                              <ul>
                                {review.evidence_reviewed.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            )}
                            <strong>{review.next_action}</strong>
                            {review.resources.map(({ resource, reason }) => (
                              <a
                                className="career-review-resource"
                                href={resource.url}
                                target="_blank"
                                rel="noreferrer"
                                key={resource.id}
                              >
                                {resource.title} · {reason}
                                <ArrowUpRight size={12} />
                              </a>
                            ))}
                            {review.recommendation === "advance" ? (
                              <button
                                className="primary"
                                disabled={completingWeek === week.week}
                                onClick={() => void completeLevel(week.week)}
                              >
                                {completingWeek === week.week
                                  ? "Saving level…"
                                  : "Complete level & open next"}
                                <ArrowRight size={14} />
                              </button>
                            ) : (
                              <span className="career-review-hold">
                                Keep this level open until you have tried the
                                extra step.
                              </span>
                            )}
                            <small>{review.notice}</small>
                          </section>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
            <LearningBranches
              planId={plan.id || state.profile.goal || plan.title}
              resources={plan.resources ?? []}
            />
            <section
              className={`career-opportunity-quest ${readyForPrepQuest ? "is-unlocked" : ""}`}
              aria-labelledby="career-prep-quest-title"
            >
              <span className="career-quest-node" aria-hidden="true">
                {readyForPrepQuest ? (
                  <Medal size={16} />
                ) : (
                  <LockKeyhole size={15} />
                )}
              </span>
              <div className="career-quest-content">
                <div className="career-quest-heading">
                  <div>
                    <small>APPLICATION PREPARATION</small>
                    <h3 id="career-prep-quest-title">
                      Prepare for an opportunity
                    </h3>
                  </div>
                  <strong>{prepSignals.filter(Boolean).length}/3</strong>
                </div>
                <div className="career-prep-signals">
                  {["Quiz", "CV", "Work"].map((label, index) => {
                    const complete = prepSignals[index];
                    const SignalIcon = complete ? Check : LockKeyhole;
                    return (
                      <button
                        className={complete ? "complete" : ""}
                        key={label}
                        onClick={() => {
                          if (index === 2 && weeks[nextIndex])
                            setOpenWeek(weeks[nextIndex].week);
                          else
                            navigateApp(
                              index === 1
                                ? "/app/review"
                                : "/app/progress?view=practice",
                            );
                        }}
                      >
                        <SignalIcon size={12} /> {label}
                      </button>
                    );
                  })}
                </div>
                {signalsError && (
                  <p className="career-tree-error" role="alert">
                    {signalsError}
                  </p>
                )}
                {opportunityRoutes.length > 0 ? (
                  <div className="career-quest-links">
                    {opportunityRoutes.slice(0, 2).map((opportunity) => (
                      <div
                        className="career-quest-opportunity"
                        key={opportunity.url}
                      >
                        <a
                          href={opportunity.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {opportunity.title}
                          <ArrowUpRight size={13} />
                        </a>
                        <small>
                          {opportunity.provider} · {opportunity.location}
                        </small>
                        {opportunity.required_skills?.length ? (
                          <details>
                            <summary>Compare listed skills</summary>
                            <div className="career-required-skills">
                              {opportunity.required_skills.map((skill) => {
                                const signals = skillSignals(skill);
                                const found =
                                  signals.cv || signals.quiz || signals.work;
                                return (
                                  <span
                                    className={found ? "has-evidence" : ""}
                                    key={skill}
                                  >
                                    <strong>{skill}</strong>
                                    <i>
                                      {[
                                        signals.cv && "CV",
                                        signals.quiz && "Quiz",
                                        signals.work && "Work",
                                      ]
                                        .filter(Boolean)
                                        .join(" · ") || "No signal"}
                                    </i>
                                  </span>
                                );
                              })}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="career-quest-empty">
                    No current listing verified for this goal. Keep building
                    proof and check Discover for new calls.
                  </p>
                )}
                {trainingRoutes[0] && (
                  <a
                    className="career-training-link"
                    href={trainingRoutes[0].url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Explore training: {trainingRoutes[0].name}
                    <ArrowUpRight size={12} />
                  </a>
                )}
                <small className="career-quest-note">
                  Your signals are for planning only. Listings stay open to
                  everyone.
                </small>
              </div>
            </section>
          </div>
        </>
      )}
    </section>
  );
}
