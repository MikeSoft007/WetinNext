import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import ProgressOverview from "../src/features/progress/ProgressOverview";
import WeekReviewModal from "../src/features/progress/WeekReviewModal";
import type { State } from "../src/shared/types";
vi.mock("../src/shared/api", () => ({ api: vi.fn() }));
import { api } from "../src/shared/api";
test("week overview opens its detailed review and Escape returns to the overview", async () => {
  const week = {
    week: 1,
    title: "Cloud foundations",
    description: "Understand cloud services and deployment models.",
    learning_objectives: ["Explain an infrastructure service"],
    task: "Compare two deployment models",
    success: "A written comparison",
    resource_id: "cloud",
    minutes: 60,
  };
  const state: State = {
    profile: { goal: "Learn DevOps" },
    plan: {
      id: "plan",
      title: "DevOps starter",
      outcome: "Build evidence",
      engine: "test",
      notice: "",
      weeks: [week],
      resources: [
        {
          id: "cloud",
          title: "Cloud lesson",
          provider: "Example",
          url: "https://example.org/cloud",
          cost: "Free",
          format: "Text",
          device: "phone",
          review: "Learn the foundations",
        },
      ],
    },
    progress: {},
    applications: {},
  };
  vi.mocked(api).mockImplementation(async (path) =>
    path === "/me/readiness"
      ? { evidence_count: 0, cv_reviewed: false, practice: null }
      : {
          week: 1,
          title: week.title,
          sprint_id: "plan",
          resource: state.plan?.resources?.[0],
          actions: [],
          checklist: {},
          reflection: "",
          evidence_url: "",
        },
  );
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <ProgressOverview
          state={state}
          onStart={() => {}}
          onContinue={() => setOpen(true)}
          onWeekClick={() => setOpen(true)}
        />
        {open && (
          <WeekReviewModal
            state={state}
            week={week}
            onClose={() => setOpen(false)}
            onComplete={async () => {}}
            onSaved={() => {}}
          />
        )}
      </>
    );
  }
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Review week 1: Cloud foundations" }),
  );
  expect(
    screen.getByRole("dialog", { name: "Cloud foundations" }),
  ).toBeTruthy();
  expect(screen.getByText(week.description)).toBeTruthy();
  expect(
    screen.getByRole("link", { name: /Cloud lesson/ }).getAttribute("href"),
  ).toBe("https://example.org/cloud");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Review week 1: Cloud foundations" }),
  );
});
