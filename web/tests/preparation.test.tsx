import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi, afterEach } from "vitest";
import GoalPreparation from "../src/features/progress/GoalPreparation";
import ProgressOverview from "../src/features/progress/ProgressOverview";
import ReadinessCheck from "../src/features/progress/ReadinessCheck";
import type { State } from "../src/shared/types";
vi.mock("../src/shared/api", () => ({ api: vi.fn() }));
import { api } from "../src/shared/api";
const state = {
  profile: { goal: "Learn nursing" },
  plan: null,
  progress: {},
  applications: {},
} as State;
afterEach(() => history.replaceState({}, "", "/"));
test("build plan link opens the actual plan builder route", async () => {
  render(
    <ProgressOverview state={state} onStart={vi.fn()} onContinue={vi.fn()} />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("link", { name: "Build my researched plan" }));
  expect(location.pathname).toBe("/app/discover");
  expect(location.search).toBe("?view=plan");
});
test("practice page without a plan provides an actionable plan builder", async () => {
  vi.mocked(api).mockImplementation(async (path) =>
    path === "/me/assessment" ? null : { practice: null, evidence_count: 0 },
  );
  render(<ReadinessCheck state={state} />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Build my researched plan" }));
  expect(location.pathname + location.search).toBe("/app/discover?view=plan");
});
test("heatmap switches the selected goal and saves reminder choices", async () => {
  const reminder = {
    enabled: false,
    days: [0, 3],
    time: "18:00",
    timezone: "Africa/Kigali",
    focus: "weekly practice",
  };
  const goal = {
    id: "nursing",
    goal: "Learn nursing",
    active: true,
    signals: [
      { label: "Plan", done: false },
      { label: "Practice", done: false },
      { label: "Evidence", done: false },
      { label: "Quiz", done: false },
      { label: "CV", done: false },
    ],
    completed_signals: 0,
    weeks: [],
    evidence_count: 0,
    next_focus: "Plan",
    reminder,
  };
  vi.mocked(api).mockImplementation(async (path) =>
    path === "/me/preparation" ? { goals: [goal] } : {},
  );
  render(<GoalPreparation state={state} onSwitch={vi.fn(async () => {})} />);
  const user = userEvent.setup();
  await screen.findByRole("table", { name: "Preparation signals by goal" });
  await user.click(
    screen.getByRole("button", {
      name: "Learn nursing: Plan not yet recorded",
    }),
  );
  expect(location.search).toBe("?view=plan");
  await user.click(screen.getByText("Focus reminders"));
  await user.click(
    screen.getByRole("checkbox", { name: "Remind me about this goal" }),
  );
  await user.selectOptions(
    screen.getByLabelText("Focus area"),
    "practice quiz",
  );
  await user.click(screen.getByRole("button", { name: "Save reminders" }));
  expect(api).toHaveBeenCalledWith(
    "/me/reminders",
    expect.objectContaining({
      method: "PUT",
      body: expect.stringContaining("practice quiz"),
    }),
  );
  expect(await screen.findByText("Reminder preferences saved.")).toBeTruthy();
});
