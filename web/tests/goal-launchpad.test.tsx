import { render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import GoalLaunchpad from "../src/features/learning/GoalLaunchpad";
import type { State } from "../src/shared/types";
vi.mock("../src/shared/api", () => ({ api: vi.fn() }));
import { api } from "../src/shared/api";
test("shows only research for the active goal and market and clears old matches on scope change", async () => {
  const state: State = {
    goal_id: "nursing",
    profile: { goal: "Learn nursing" },
    plan: null,
    progress: {},
    applications: {},
  };
  vi.mocked(api).mockImplementation(async (path) =>
    path.includes("Rwanda")
      ? {
          id: "guide",
          status: "complete",
          stage: "Complete",
          result: {
            resources: [
              {
                id: "lesson",
                title: "Nursing foundations",
                provider: "Nursing school",
                url: "https://example.edu/nursing",
                skill: "Anatomy",
              },
            ],
            places: [],
            opportunities: [
              {
                title: "Nursing training intake",
                provider: "Example college",
                url: "https://example.edu/admissions",
                eligibility: "Check entry qualifications",
                deadline_note: "Confirm deadline with admissions",
              },
            ],
          },
        }
      : null,
  );
  const { rerender } = render(<GoalLaunchpad state={state} market="Rwanda" />);
  expect(
    await screen.findByRole("link", { name: /Nursing foundations/ }),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: /Nursing training intake/ })
      .getAttribute("href"),
  ).toBe("https://example.edu/admissions");
  rerender(<GoalLaunchpad state={state} market="Nigeria" />);
  await waitFor(() =>
    expect(screen.queryByText("Nursing training intake")).toBeNull(),
  );
  expect(
    await screen.findByRole("button", {
      name: /Find resources & opportunities/,
    }),
  ).toBeTruthy();
  expect(api).toHaveBeenCalledWith("/me/research?market=Nigeria");
});
