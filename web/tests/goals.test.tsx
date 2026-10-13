import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import GoalSwitcher from "../src/features/goals/GoalSwitcher";
import SkillTracker from "../src/features/progress/SkillTracker";
import type { State } from "../src/shared/types";
vi.mock("../src/shared/api", () => ({ api: vi.fn() }));
import { api } from "../src/shared/api";
const state = {
  profile: { goal: "Learn nursing" },
  plan: null,
  progress: {},
  applications: {},
} as State;
test("goal switcher restores a selected goal and supports adding another", async () => {
  vi.mocked(api).mockImplementation(async (path) =>
    path === "/me/goals"
      ? [
          {
            id: "nursing",
            goal: "Learn nursing",
            active: true,
            has_plan: false,
            completed_weeks: 0,
            country: "Rwanda",
          },
          {
            id: "web",
            goal: "Frontend developer",
            active: false,
            has_plan: true,
            completed_weeks: 2,
            country: "Nigeria",
          },
        ]
      : { saved: true },
  );
  const switched = vi.fn(async () => {}),
    add = vi.fn();
  render(<GoalSwitcher state={state} onAdd={add} onSwitched={switched} />);
  await screen.findByRole("option", { name: "Frontend developer" });
  const user = userEvent.setup();
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Working towards" }),
    "web",
  );
  expect(api).toHaveBeenCalledWith("/me/goals/web/activate", {
    method: "POST",
  });
  expect(switched).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "Add a goal" }));
  expect(add).toHaveBeenCalledOnce();
});
test("skill tracker shows practice and evidence without claiming mastery", async () => {
  vi.mocked(api).mockResolvedValue({
    goal: "Frontend developer",
    notice: "Self-reported practice, not verified proficiency.",
    skills: [
      {
        name: "HTML",
        planned_weeks: [1, 4],
        practised_weeks: [1],
        evidence_count: 1,
        next_week: 4,
      },
    ],
  });
  render(<SkillTracker state={state} />);
  expect(await screen.findByRole("heading", { name: "HTML" })).toBeTruthy();
  expect(
    screen.getByText("1/2 weeks practised · 1 saved work example"),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: /Next: week 4/ })).toBeTruthy();
});
test("empty goal history offers an actionable first-goal button", async () => {
  vi.mocked(api).mockResolvedValue([]);
  const add = vi.fn();
  render(
    <GoalSwitcher
      state={{ ...state, profile: { ...state.profile, goal: "" } }}
      onAdd={add}
      onSwitched={async () => {}}
    />,
  );
  await userEvent
    .setup()
    .click(
      await screen.findByRole("button", { name: "Choose your first goal" }),
    );
  expect(add).toHaveBeenCalledOnce();
});
test("existing profile adds goals without asking for a name again", async () => {
  const { OnboardingModal } = await import(
    "../src/features/goals/OnboardingModal"
  );
  const profile = {
    name: "Ada",
    goal: "Explore nursing",
    country: "Nigeria",
    hours: 3,
    device: "phone",
    low_data: true,
    learner_type: "student",
    background: "",
    career_track: "auto",
  } as import("../src/shared/types").Profile;
  render(
    <OnboardingModal
      hasProfile
      profile={profile}
      setProfile={vi.fn()}
      busy={false}
      error=""
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />,
  );
  expect(screen.queryByRole("textbox", { name: "Your first name" })).toBeNull();
  expect(
    screen.getByRole("textbox", { name: "Your career or learning goal" }),
  ).toBeTruthy();
});
