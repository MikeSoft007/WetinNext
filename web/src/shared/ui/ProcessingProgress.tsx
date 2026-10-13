import { useId } from "react";

type Props = { label: string; detail: string };

/** Requests expose stages, not measurable completion percentages. */
export default function ProcessingProgress({ label, detail }: Props) {
  const detailId = useId();
  return (
    <div className="processing-progress">
      <div className="processing-progress-label">
        <span>{label}</span>
        <span>In progress</span>
      </div>
      <div
        className="moving-progress"
        role="progressbar"
        aria-label={label}
        aria-describedby={detailId}
      >
        <span />
      </div>
      <p id={detailId}>{detail}</p>
    </div>
  );
}
