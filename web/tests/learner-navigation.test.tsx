import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import LearnerWorkspace from "../src/features/learner/LearnerWorkspace";
vi.mock("../src/shared/api", () => ({ api: vi.fn() }));
import { api } from "../src/shared/api";
test("learner navigation has three core sections and Review stays in the workspace", async () => {
  history.replaceState({}, "", "/app");
  vi.mocked(api).mockImplementation(async (path) =>
    path === "/me/assessment"
      ? null
      : path === "/health"
        ? { demo_mode: false }
        : path === "/me"
          ? {
              profile: { name: "Ada" },
              plan: null,
              progress: {},
              applications: {},
            }
          : [],
  );
  render(<LearnerWorkspace onSignOut={vi.fn(async () => {})} />);
  const user = userEvent.setup();
  expect(
    await screen.findByRole("button", { name: "Discover", exact: true }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Today", exact: true }),
  ).toBeNull();
  expect(
    screen.getByRole("combobox", { name: "Search location" }),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Review", exact: true }));
  expect(location.pathname).toBe("/app/review");
  expect(
    await screen.findByText("Use résumé or personal website text"),
  ).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: "Progress", exact: true }),
  );
  expect(location.pathname).toBe("/app/progress");
  await user.click(
    screen.getByRole("button", { name: "Skill evidence", exact: true }),
  );
  expect(location.pathname + location.search).toBe("/app/progress?view=skills");
  expect(
    screen
      .getByRole("button", { name: "Skill evidence", exact: true })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  history.pushState({}, "", "/app/progress?view=portfolio");
  window.dispatchEvent(new PopStateEvent("popstate"));
  expect(
    await screen.findByRole("button", {
      name: "Portfolio & applications",
      exact: true,
    }),
  ).toBeTruthy();
  history.replaceState({}, "", "/");
});
