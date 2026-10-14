import { useState } from "react";
import { ArrowRight, Compass } from "lucide-react";
export default function GoalPrompt({
  onGoal,
}: {
  onGoal: (goal: string) => void;
}) {
  const [goal, setGoal] = useState("");
  return (
    <section className="goal-prompt">
      <span className="public-eyebrow">LET’S FIND YOUR NEXT STEP</span>
      <h2>What is your goal today?</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (goal.trim().length >= 5) onGoal(goal.trim());
        }}
      >
        <Compass size={20} aria-hidden="true" />
        <input
          aria-label="Your goal today"
          required
          minLength={5}
          maxLength={500}
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          placeholder="I want to learn DevOps, become a nurse…"
        />
        <button className="primary" disabled={goal.trim().length < 5}>
          Build my direction <ArrowRight size={15} />
        </button>
      </form>
      <small>
        We’ll use your existing profile, then confirm your time and learning
        needs.
      </small>
    </section>
  );
}
