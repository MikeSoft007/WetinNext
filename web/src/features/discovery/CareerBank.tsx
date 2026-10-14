import { useState } from "react";
import type { State } from "../../shared/types";
import GoalOpenings from "./GoalOpenings";
export default function CareerBank({
  state,
  market = "Global",
}: {
  state?: State | null;
  market?: string;
  onChoose?: (title: string) => void;
}) {
  const [refreshVersion, setRefreshVersion] = useState(0);
  return (
    <section className="career-bank">
      <header>
        <div>
          <span className="public-eyebrow">YOUR NEXT APPLICATION</span>
          <h2>Career bank</h2>
        </div>
        <button
          className="text-link"
          onClick={() => setRefreshVersion((value) => value + 1)}
        >
          Refresh openings
        </button>
      </header>
      <p>
        Jobs, internships, scholarships and admissions accepting applications
        for your goal.
      </p>
      <GoalOpenings
        goal={state?.profile.goal || ""}
        market={market}
        refreshVersion={refreshVersion}
      />
    </section>
  );
}
