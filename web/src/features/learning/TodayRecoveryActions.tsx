import {
  CalendarClock,
  Check,
  CircleHelp,
  FileCheck2,
  SlidersHorizontal,
} from "lucide-react";

type CheckInStatus = "done" | "stuck" | "more-time";
type Props = {
  busy: boolean;
  note: string;
  advice?: string;
  onNoteChange: (note: string) => void;
  onCheckIn: (status: CheckInStatus) => void;
  onAdjust: () => void;
  onDiscover: () => void;
};

export default function TodayRecoveryActions({
  busy,
  note,
  advice,
  onNoteChange,
  onCheckIn,
  onAdjust,
  onDiscover,
}: Props) {
  return (
    <div className="today-checkin">
      <label className="note-label" htmlFor="reflection">
        How is it going? <span>(optional)</span>
      </label>
      <textarea
        id="reflection"
        maxLength={1000}
        placeholder="A quick note can help you pick up where you left off."
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
      />
      {advice && <p className="advice">{advice}</p>}
      <div className="checkin-actions">
        <button
          className="primary"
          disabled={busy}
          onClick={() => onCheckIn("done")}
        >
          <Check size={16} />I finished this
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => onCheckIn("stuck")}
        >
          <CircleHelp size={16} />
          I’m finding it tricky
        </button>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => onCheckIn("more-time")}
        >
          <CalendarClock size={15} />I need more time
        </button>
      </div>
      <div className="today-recovery-links">
        <button className="inline-link" onClick={onAdjust}>
          Make this fit my week <SlidersHorizontal size={13} />
        </button>
        <button className="inline-link" onClick={onDiscover}>
          Find another learning resource <FileCheck2 size={13} />
        </button>
      </div>
    </div>
  );
}
