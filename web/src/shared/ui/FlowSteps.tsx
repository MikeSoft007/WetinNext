import { Check } from "lucide-react";
export default function FlowSteps({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="flow-steps" aria-label="Your progress">
      {steps.map((label, index) => (
        <li
          key={label}
          className={
            index + 1 === current
              ? "current"
              : index + 1 < current
                ? "complete"
                : ""
          }
          aria-current={index + 1 === current ? "step" : undefined}
        >
          <span>
            {index + 1 < current ? (
              <Check size={14} />
            ) : (
              String(index + 1).padStart(2, "0")
            )}
          </span>
          <strong>{label}</strong>
        </li>
      ))}
    </ol>
  );
}
