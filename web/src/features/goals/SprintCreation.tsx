import ProcessingProgress from "../../shared/ui/ProcessingProgress";
import { Sparkles, BookOpen, Flag } from "lucide-react";
export default function SprintCreation() {
  return (
    <div className="sprint-creation" role="status">
      <div className="sprint-orbit">
        <svg viewBox="0 0 240 170" aria-hidden="true">
          <path d="M25 130C35 10 130 155 210 35" pathLength="100" />
          <circle cx="25" cy="130" r="8" />
          <circle cx="98" cy="92" r="8" />
          <circle cx="157" cy="83" r="8" />
          <circle cx="210" cy="35" r="8" />
        </svg>
        <span className="sprint-orbit-icon">
          <Sparkles size={26} />
        </span>
        <span className="sprint-orbit-book">
          <BookOpen size={20} />
        </span>
        <span className="sprint-orbit-flag">
          <Flag size={20} />
        </span>
      </div>
      <span className="public-eyebrow">YOUR NEXT CHAPTER IS TAKING SHAPE</span>
      <h3>Making room for your ambition.</h3>
      <p>
        Saving your goal and preparing to research learning, training and your
        next steps.
      </p>
      <ProcessingProgress
        label="Creating your sprint"
        detail="Saving your starting point. Live research continues in your workspace."
      />
      <span className="subtle">
        If AI is unavailable, you’ll receive a clearly labelled starter plan.
      </span>
    </div>
  );
}
