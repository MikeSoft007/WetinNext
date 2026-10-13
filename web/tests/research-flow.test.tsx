import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { test, expect, vi } from "vitest";
import GoalResearch from "../src/features/discovery/GoalResearch";
import type { State } from "../src/shared/types";
vi.mock("../src/shared/api", () => ({ api: vi.fn() }));
import { api } from "../src/shared/api";
const state: State = {
  profile: {
    goal: "Learn nursing",
    country: "Rwanda",
    hours: 3,
    device: "phone",
    low_data: true,
  },
  plan: null,
  progress: {},
  applications: {},
};
const guide = {
  title: "Your nursing starting point",
  orientation: "Start with anatomy and recognised education.",
  qualification_route: "Recognised training is required to practise.",
  goal: "Learn nursing",
  location: "Kigali, Rwanda",
  resources: [
    {
      id: "anatomy",
      title: "Anatomy for beginners",
      provider: "Example university",
      url: "https://example.edu/anatomy",
      format: "Textbook",
      access_note: "Free online; print costs extra.",
      why_it_fits: "Understand body systems.",
      skill: "Anatomy",
    },
  ],
  places: [
    {
      name: "Example Nursing School",
      kind: "School",
      location: "Kigali",
      url: "https://example.edu/nursing",
      entry_route: "Check requirements.",
      cost_note: "Tuition applies.",
      availability_note: "Intake unverified.",
      accreditation_note: "Confirm with regulator.",
    },
  ],
  opportunities: [],
  weeks: [1, 2, 3, 4].map((week) => ({
    week,
    title: `Theory week ${week}`,
    task: "Read and save a note.",
    success: "A saved note.",
    resource_id: "anatomy",
    minutes: 60,
  })),
  sources: [{ title: "Example source", url: "https://example.edu/anatomy" }],
  next_question: "What is your prior education?",
  researched_at: "2026-10-13T00:00:00Z",
  notice: "Introductory learning only.",
};
test("live research goes from city to sourced learning, schools/map and saved plan", async () => {
  vi.mocked(api).mockImplementation(async (path) =>
    path === "/research"
      ? { id: "123" }
      : path === "/research/123"
        ? { status: "complete", stage: "Ready", result: guide }
        : { saved: true },
  );
  const saved = vi.fn(async () => {});
  render(
    <GoalResearch
      state={state}
      market="Rwanda"
      onSaved={saved}
      onSetup={vi.fn()}
    />,
  );
  const user = userEvent.setup();
  await user.type(
    screen.getByRole("textbox", { name: "City or region" }),
    "Kigali",
  );
  await user.click(screen.getByRole("button", { name: "Research my goal" }));
  expect(
    await screen.findByRole("link", { name: /Anatomy for beginners/ }),
  ).toBeTruthy();
  expect(screen.getByText("Example university · Textbook")).toBeTruthy();
  expect(screen.getByText("Free online; print costs extra.")).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: /Schools & opportunities/ }),
  );
  expect(
    screen.getByRole("heading", { name: "Example Nursing School" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Find on map" }).getAttribute("href"),
  ).toContain("maps/search");
  await user.click(screen.getByRole("button", { name: "Your four weeks" }));
  await user.click(screen.getByRole("button", { name: "Use this plan" }));
  expect(saved).toHaveBeenCalledOnce();
  expect(
    await screen.findByRole("link", { name: "Open my weekly workspace" }),
  ).toBeTruthy();
});
test("no goal starts onboarding instead of pretending to search", async () => {
  vi.mocked(api).mockClear();
  const setup = vi.fn();
  render(
    <GoalResearch
      state={{ ...state, profile: {} }}
      market="Rwanda"
      onSaved={vi.fn()}
      onSetup={setup}
    />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Choose my goal" }));
  expect(setup).toHaveBeenCalledOnce();
  expect(api).not.toHaveBeenCalled();
});

test("server restores a saved guide after browser refresh without session id", async () => {
  vi.mocked(api).mockImplementation(async (path) =>
    path.startsWith("/me/research")
      ? { id: "restored", status: "complete", stage: "Ready", result: guide }
      : path === "/research/restored"
        ? { status: "complete", stage: "Ready", result: guide }
        : {},
  );
  render(
    <GoalResearch
      state={state}
      market="Rwanda"
      onSaved={vi.fn()}
      onSetup={vi.fn()}
    />,
  );
  expect(
    await screen.findByRole("link", { name: /Anatomy for beginners/ }),
  ).toBeTruthy();
  expect(screen.queryByText(/expired or is unavailable/)).toBeNull();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: /Show learning image/ }));
  expect(
    screen.getByRole("img", { name: /African learners/ }).getAttribute("src"),
  ).toBe("/images/learning-together.jpg");
});

test("sources are paginated six per page", async () => {
  const result = {
    ...guide,
    sources: Array.from({ length: 14 }, (_, i) => ({
      title: `Reference ${i + 1}`,
      url: `https://example.edu/source-${i + 1}`,
    })),
  };
  vi.mocked(api).mockImplementation(async (path) =>
    path.startsWith("/me/research")
      ? { id: "paged", status: "complete", stage: "Ready", result }
      : path === "/research/paged"
        ? { status: "complete", stage: "Ready", result }
        : {},
  );
  render(
    <GoalResearch
      state={state}
      market="Rwanda"
      onSaved={vi.fn()}
      onSetup={vi.fn()}
    />,
  );
  await screen.findByText("Sources & important details");
  const user = userEvent.setup();
  await user.click(screen.getByText("Sources & important details"));
  expect(screen.getByRole("link", { name: /^Reference 1\b/ })).toBeTruthy();
  expect(screen.queryByRole("link", { name: /^Reference 7\b/ })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Next page" }));
  expect(screen.getByRole("link", { name: /Reference 7/ })).toBeTruthy();
});

test("assessment guide link navigates to the practice section", async () => {
  vi.mocked(api).mockImplementation(async (path) =>
    path.startsWith("/me/research")
      ? { id: "practice", status: "complete", stage: "Ready", result: guide }
      : path === "/research/practice"
        ? { status: "complete", stage: "Ready", result: guide }
        : {},
  );
  render(
    <GoalResearch
      state={state}
      market="Rwanda"
      onSaved={vi.fn()}
      onSetup={vi.fn()}
    />,
  );
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Assess your next step" }),
  );
  await user.click(
    screen.getByRole("link", { name: /Open my in-app practice/ }),
  );
  expect(location.pathname).toBe("/app/progress");
  expect(location.hash).toBe("#practice-check");
  history.replaceState({}, "", "/");
});
