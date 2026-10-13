import SprintCreation from "./SprintCreation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  X,
  ArrowRight,
  ArrowLeft,
  Clock3,
  Laptop,
  MapPin,
  ShieldCheck,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import type { Profile } from "../../shared/types";
import LearnerIllustration from "../../shared/illustrations/LearnerIllustration";
import FlowSteps from "../../shared/ui/FlowSteps";
type Props = {
  hasProfile?: boolean;
  profile: Profile;
  setProfile: Dispatch<SetStateAction<Profile>>;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
};
const tracks = [
  ["auto", "Suggest from my goal"],
  ["infrastructure", "Data centre & infrastructure"],
  ["data", "Data fundamentals"],
  ["frontend", "Frontend development"],
  ["backend", "Backend development"],
  ["cybersecurity", "Cybersecurity"],
  ["marketing", "Digital marketing"],
  ["support", "Customer support"],
  ["project", "Project coordination"],
  ["scholarship", "Scholarship preparation"],
  ["foundation", "Digital foundations"],
];
export function OnboardingModal({
  hasProfile = false,
  profile,
  setProfile,
  busy,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [step, setStep] = useState(1);
  const dialog = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((previous) => ({ ...previous, [key]: value }));
  }
  return (
    <div className="modal-backdrop">
      <section
        ref={dialog}
        className="modal goal-flow"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) {
            event.stopPropagation();
            onClose();
            return;
          }
          if (event.key !== "Tab") return;
          const nodes = Array.from(
            dialog.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
            ) || [],
          ).filter((node) => node.getClientRects().length > 0);
          if (event.shiftKey && document.activeElement === nodes[0]) {
            event.preventDefault();
            nodes.at(-1)?.focus();
          } else if (
            !event.shiftKey &&
            document.activeElement === nodes.at(-1)
          ) {
            event.preventDefault();
            nodes[0]?.focus();
          }
        }}
      >
        <button
          className="close-modal"
          aria-label="Close setup"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <aside className="flow-story">
          <a className="public-brand" href="/">
            WetinNext<span>.</span>
          </a>
          <div>
            <span className="public-eyebrow">
              SMALL STEPS. REAL POSSIBILITIES.
            </span>
            <h2>
              Your next chapter
              <br />
              starts with you.
            </h2>
            <p>
              A direction that fits your ambitions, your time and your everyday
              life.
            </p>
          </div>
          <LearnerIllustration />
          <span className="flow-note">
            <ShieldCheck size={15} />
            You can adjust your direction as you grow.
          </span>
        </aside>
        <div className="flow-main">
          <FlowSteps steps={["Your goal", "Your pace"]} current={step} />
          <form
            onSubmit={(event) => {
              if (step < 2) {
                event.preventDefault();
                setStep(step + 1);
              } else onSubmit(event);
            }}
            aria-busy={busy}
          >
            {busy ? (
              <SprintCreation />
            ) : (
              <div className="flow-panel" key={step}>
                <span className="public-eyebrow">
                  STEP {String(step).padStart(2, "0")} / 02
                </span>
                <h2 id="setup-title" ref={heading} tabIndex={-1}>
                  {step === 1
                    ? "Where would you like to go?"
                    : "Make room for your next step."}
                </h2>
                <p className="flow-description">
                  {step === 1
                    ? "Tell us what you’re working towards. You don’t need the perfect words."
                    : "A realistic pace beats a perfect plan. Start with what you have."}
                </p>
                <fieldset
                  className="onboarding-step"
                  hidden={step !== 1}
                  disabled={step !== 1 || busy}
                >
                  <label>
                    Your career or learning goal
                    <textarea
                      required
                      minLength={5}
                      maxLength={500}
                      value={profile.goal}
                      onChange={(e) => {
                        update("goal", e.target.value);
                        update("career_track", "auto");
                      }}
                      placeholder="I’d like to become a frontend developer, but I’m starting from scratch…"
                    />
                  </label>
                  <div className="goal-prompts" aria-label="Example goals">
                    {[
                      "Prepare for a data internship",
                      "Build my first website",
                      "Explore scholarship opportunities",
                    ].map((goal) => (
                      <button
                        type="button"
                        key={goal}
                        onClick={() => {
                          update("goal", goal);
                          update("career_track", "auto");
                        }}
                      >
                        {goal}
                        <ArrowRight size={13} />
                      </button>
                    ))}
                  </div>
                  <details className="goal-optional">
                    <summary>
                      Choose a starting track <span>(optional)</span>
                    </summary>
                    <label>
                      Starting track
                      <select
                        value={profile.career_track || "auto"}
                        onChange={(e) =>
                          update(
                            "career_track",
                            e.target.value as Profile["career_track"],
                          )
                        }
                      >
                        {tracks.map(([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </details>
                  <div className="form-grid">
                    {!hasProfile && (
                      <label>
                        Your first name
                        <input
                          required
                          maxLength={80}
                          value={profile.name}
                          onChange={(e) => update("name", e.target.value)}
                          placeholder="What should we call you?"
                        />
                      </label>
                    )}
                    <label>
                      Where are you based?
                      <select
                        value={profile.country}
                        onChange={(e) => update("country", e.target.value)}
                      >
                        <option>Nigeria</option>
                        <option>Rwanda</option>
                        <option>Other</option>
                      </select>
                    </label>
                  </div>
                </fieldset>
                <fieldset
                  className="onboarding-step"
                  hidden={step !== 2}
                  disabled={step !== 2 || busy}
                >
                  <div className="goal-review goal-review-summary">
                    <div>
                      <span className="public-eyebrow">YOUR DIRECTION</span>
                      <h3>{profile.goal}</h3>
                    </div>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => setStep(1)}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="form-grid">
                    <label>
                      Hours per week
                      <input
                        type="number"
                        required
                        min={1}
                        max={20}
                        value={profile.hours}
                        onChange={(e) =>
                          update("hours", Number(e.target.value))
                        }
                      />
                    </label>
                    <label>
                      Your main device
                      <select
                        value={profile.device}
                        onChange={(e) => update("device", e.target.value)}
                      >
                        <option value="laptop">Laptop / desktop</option>
                        <option value="phone">Phone</option>
                      </select>
                    </label>
                  </div>
                  <details className="goal-optional">
                    <summary>
                      Personalise your recommendations <span>(optional)</span>
                    </summary>
                    <div className="goal-optional-fields">
                      <label>
                        I’m learning as…
                        <select
                          value={profile.learner_type}
                          onChange={(e) =>
                            update("learner_type", e.target.value)
                          }
                        >
                          <option value="student">A university student</option>
                          <option value="self-taught">
                            A self-taught learner
                          </option>
                          <option value="both">Both</option>
                        </select>
                      </label>
                      <label>
                        What do you already know? <span>(optional)</span>
                        <textarea
                          maxLength={1000}
                          value={profile.background}
                          onChange={(e) => update("background", e.target.value)}
                          placeholder="A little Excel, some coding, a university project…"
                        />
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={profile.low_data}
                          onChange={(e) => update("low_data", e.target.checked)}
                        />
                        Prefer text lessons over video (lower data)
                      </label>
                    </div>
                  </details>
                </fieldset>
              </div>
            )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            {step === 2 && (
              <details className="flow-privacy">
                <summary>How your information is used</summary>
                <p>
                  OpenAI guidance uses your goal, constraints, background, CV
                  skill mentions and recorded practice. Original CVs and
                  previews stay out of AI requests. Avoid sensitive details.
                </p>
              </details>
            )}
            <div className="flow-actions">
              {step > 1 ? (
                <button
                  type="button"
                  className="text-link"
                  disabled={busy}
                  onClick={() => setStep(step - 1)}
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              ) : (
                <span className="subtle">About a minute to get started</span>
              )}
              <button className="primary" disabled={busy}>
                {busy ? (
                  <>
                    <LoaderCircle size={16} className="spin" />
                    Saving your starting plan…
                  </>
                ) : (
                  <>
                    {step === 2
                      ? hasProfile
                        ? "Save this goal"
                        : "Create my first sprint"
                      : "Continue"}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
