import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { test, expect, vi, afterEach } from "vitest";
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
    {
      name: "Search result pretending to be a school",
      kind: "School",
      location: "Kigali",
      url: "https://www.google.com/search?q=nursing+school",
      entry_route: "Search result only.",
      cost_note: "Unknown.",
      availability_note: "Unknown.",
      accreditation_note: "Unknown.",
    },
  ],
  opportunities: [
    {
      title: "Junior data assistant",
      provider: "Example programme",
      location: "Kigali",
      url: "https://example.edu/opportunities/data-assistant",
      type: "Internship",
      eligibility: "For early-career applicants.",
      required_skills: ["Spreadsheets", "Data analysis"],
      deadline_note: "Apply by 2026-12-01.",
      availability_note: "Applications are open.",
      open_status: "current_open",
      deadline: "2099-12-01",
    },
  ],
  weeks: [1, 2, 3, 4].map((week) => ({
    week,
    title: `Theory week ${week}`,
    task: "Read and save a note.",
    success: "A saved note.",
    resource_id: "anatomy",
    minutes: 60,
  })),
  sources: [
    { title: "Example source", url: "https://example.edu/anatomy" },
    {
      title: "Institution",
      url: "https://WWW.EXAMPLE.EDU/nursing/?utm_source=guide",
    },
    {
      title: "Opportunity",
      url: "https://example.edu/opportunities/data-assistant",
    },
    {
      title: "Search result",
      url: "https://www.google.com/search?q=nursing+school",
    },
  ],
  next_question: "What is your prior education?",
  researched_at: "2026-10-13T00:00:00Z",
  notice: "Introductory learning only.",
};
test("live research goes from city to sourced learning, schools/map and saved plan", async () => {
  vi.mocked(api).mockImplementation(async (path) =>
    path === "/me/cv-reviews"
      ? [{ skills: ["Spreadsheets"] }]
      : path === "/research"
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
  await user.click(screen.getByRole("button", { name: /Learn & schools/ }));
  expect(
    screen.getByRole("button", {
      name: "Learn & schools · 2",
    }),
  ).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: "Schools & training · 1" }),
  );
  expect(
    screen.getByRole("heading", { name: "Example Nursing School" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("heading", {
      name: "Search result pretending to be a school",
    }),
  ).toBeNull();
  expect(
    screen
      .getByRole("link", { name: "Institution website" })
      .getAttribute("href"),
  ).toBe("https://example.edu/nursing");
  await user.click(screen.getByRole("button", { name: "Opportunities · 1" }));
  expect(await screen.findByText("50% skill evidence")).toBeTruthy();
  expect(
    screen.getByText(/Practise Data analysis in a small project/),
  ).toBeTruthy();
  expect(
    screen.getByText(/evidence coverage, not a readiness or hiring prediction/),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Learn & schools · 2" }));
  expect(
    screen.getByRole("link", { name: "Open map" }).getAttribute("href"),
  ).toContain("openstreetmap.org");
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
  await user.click(
    screen
      .getAllByRole("button", { name: "Next page" })
      .find((button) => !(button as HTMLButtonElement).disabled)!,
  );
  expect(screen.getByRole("link", { name: /Reference 7/ })).toBeTruthy();
});

test("assessment tab always offers goal practice and an actionable next step", async () => {
  vi.mocked(api).mockImplementation(async (path) =>
    path.startsWith("/me/research")
      ? { id: "practice", status: "complete", stage: "Ready", result: guide }
      : path === "/research/practice"
        ? { status: "complete", stage: "Ready", result: guide }
        : path === "/me/readiness"
          ? {
              goal: "Learn nursing",
              practice: null,
              cv_reviewed: false,
              evidence_count: 0,
              qualification_status: "Not verified",
              eligibility_status: "Confirm each opportunity",
              notice: "Practice is not a qualification.",
            }
          : path === "/me/assessment"
            ? null
            : {},
  );
  history.replaceState({}, "", "/app/discover?view=assess");
  render(
    <GoalResearch
      state={state}
      market="Rwanda"
      onSaved={vi.fn()}
      onSetup={vi.fn()}
    />,
  );
  await screen.findByRole("heading", { name: "Your next-step check" });
  expect(
    await screen.findByRole("heading", { name: "Your next-step check" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("spinbutton", { name: "Number of questions" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Build my researched plan" }),
  ).toBeTruthy();
  expect(
    screen.getByText(/No directly sourced external assessment was verified/),
  ).toBeTruthy();
});

test("learning choice saves to the current goal rather than browser-only state", async () => {
  vi.mocked(api).mockImplementation(async (path, init) =>
    path.startsWith("/me/research")
      ? { id: "saved-guide", status: "complete", stage: "Ready", result: guide }
      : path === "/research/saved-guide"
        ? { status: "complete", stage: "Ready", result: guide }
        : path.startsWith("/me/learning-picks")
          ? init?.method === "POST"
            ? { id: "pick", url: guide.resources[0].url, status: "saved" }
            : []
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
  await userEvent
    .setup()
    .click(await screen.findByRole("button", { name: "Save for later" }));
  expect(
    await screen.findByRole("button", { name: "Saved to Progress" }),
  ).toBeTruthy();
  expect(api).toHaveBeenCalledWith("/me/learning-picks", {
    method: "POST",
    body: JSON.stringify({
      research_id: "saved-guide",
      resource_id: "anatomy",
    }),
  });
});

test("research displays actual source previews while synthesis is running", async () => {
  const job = {
    id: "progress",
    status: "running",
    stage: "Connecting sources to a four-week beginner plan",
    draft_orientation: "Start with an introductory anatomy lesson.",
    source_count: 2,
    source_preview: [
      { title: "Official anatomy lesson", url: "https://example.edu/anatomy" },
    ],
  };
  vi.mocked(api).mockImplementation(async (path) =>
    path.startsWith("/me/research") || path === "/research/progress" ? job : [],
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
    await screen.findByText("2 source pages found · checking relevance"),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: /example.edu/ })).toBeTruthy();
  expect(screen.queryByText("Guide ready")).toBeNull();
  expect(
    screen.getByText("Start with an introductory anatomy lesson."),
  ).toBeTruthy();
});

test("starts a researched plan directly from the guide without navigating to Discover", async () => {
  vi.mocked(api).mockImplementation(async (path) =>
    path.startsWith("/me/research") || path === "/research/inline"
      ? { id: "inline", status: "complete", stage: "Ready", result: guide }
      : [],
  );
  const saved = vi.fn(async () => {});
  render(
    <GoalResearch
      state={{ ...state, plan: null }}
      market="Rwanda"
      onSaved={saved}
      onSetup={vi.fn()}
    />,
  );
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Start this learning plan" }),
  );
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(api).toHaveBeenCalledWith(
    "/me/research-plan",
    expect.objectContaining({
      method: "POST",
      body: '{"research_id":"inline"}',
    }),
  );
  expect(location.pathname).not.toBe("/app/discover");
});

afterEach(() => {
  history.replaceState({}, "", "/");
});
