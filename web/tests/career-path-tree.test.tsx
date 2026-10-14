import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import CareerPathTree from "../src/features/goals/CareerPathTree";
import type { State } from "../src/shared/types";
vi.mock("../src/shared/api", () => ({ api: vi.fn() }));
import { api } from "../src/shared/api";

const state: State = {
  profile: { goal: "Become a data analyst" },
  plan: {
    id: "data-sprint",
    title: "Data analysis starter sprint",
    outcome: "Create a small data story",
    engine: "test",
    notice: "Starter learning only.",
    research_guide: {
      opportunities: [
        {
          title: "Junior analyst internship",
          provider: "Example Institute",
          location: "Nigeria",
          url: "https://example.org/internship",
          type: "Internship",
          eligibility: "Check the source",
          deadline_note: "Check the source",
          availability_note: "Current at last review",
          required_skills: ["Spreadsheet basics", "Data visualisation"],
        },
      ],
    },
    resources: [
      {
        id: "spreadsheet",
        title: "Spreadsheet basics",
        provider: "Example Learning",
        url: "https://example.org/spreadsheets",
        skills: ["Spreadsheet basics"],
        format: "Text",
        device: "phone",
        cost: "Free",
        review: "Beginner resource.",
        sample_exercise: "Sort a small table by date.",
      },
    ],
    weeks: [1, 2, 3, 4].map((week) => ({
      week,
      title: [
        "Find the question",
        "Clean a dataset",
        "Explore patterns",
        "Tell the story",
      ][week - 1],
      description: `Week ${week} introduces a practical data analysis concept.`,
      learning_objectives: ["Explain the question a dataset can answer"],
      resource_guidance: "Read the introduction, then sort your sample table.",
      task: `Complete week ${week} work.`,
      success: `A week ${week} artifact.`,
      resource_id: week === 1 ? "spreadsheet" : "spreadsheet",
      minutes: 60,
    })),
  },
  progress: {
    "1": { status: "done", note: "", advice: "" },
  },
  applications: {},
};

afterEach(() => {
  vi.mocked(api).mockReset();
  history.replaceState({}, "", "/");
});

test("maps weekly steps, source, evidence and earned XP into a career tree", async () => {
  vi.mocked(api).mockImplementation((path) => {
    if (path === "/me/portfolio")
      return Promise.resolve([
        {
          week: 1,
          checklist: { learn: true, build: true },
          evidence_url: "",
          reflection: "",
          learning_note: "I learned to sort a table before summarising it.",
          practice_example: "I sorted a sample sales table.",
          open_question: "How should I handle missing values?",
        },
      ]);
    if (path === "/me/readiness")
      return Promise.resolve({
        practice: { correct: 1, total: 1 },
        cv_reviewed: true,
        evidence_count: 1,
      });
    if (path === "/me/cv-reviews")
      return Promise.resolve([
        { goal: "Become a data analyst", skills: ["Spreadsheet basics"] },
      ]);
    if (path === "/me/assessment")
      return Promise.resolve({
        completed: true,
        result: {
          correct: 1,
          total: 1,
          feedback: [
            {
              correct: true,
              source: { skills: ["Spreadsheet basics"] },
            },
          ],
        },
      });
    if (path.startsWith("/weeks/") && !path.endsWith("/check-in")) {
      const week = Number(path.match(/weeks\/(\d+)/)?.[1] ?? 1);
      return Promise.resolve({
        week,
        sprint_id: "data-sprint",
        title: state.plan?.weeks.find((item) => item.week === week)?.title,
        resource: state.plan?.resources?.[0],
        actions: [
          { id: "learn", title: "Learn one useful idea", detail: "Read." },
          { id: "build", title: "Put it into practice", detail: "Try it." },
          { id: "verify", title: "Check and save evidence", detail: "Check." },
        ],
        checklist: { learn: true, build: true, verify: true },
        evidence_url: "",
        reflection: "I sorted a small table.",
        learning_note: "I sorted a small table.",
      });
    }
    if (path === "/pathway/branch-review")
      return Promise.resolve({
        recommendation: "advance",
        assessment: "Your saved work meets this level's success criteria.",
        evidence_reviewed: [
          "Three actions are checked.",
          "A learning note is saved.",
        ],
        next_action: "Continue to the next level.",
        resources: [],
        notice: "AI review uses saved evidence.",
      });
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });
  const onComplete = vi.fn(async () => {});
  const { container } = render(
    <CareerPathTree state={state} onComplete={onComplete} />,
  );
  expect(await screen.findByText("Become a data analyst")).toBeTruthy();
  expect(screen.getAllByText("Become a data analyst")).toHaveLength(1);
  expect(
    screen.getByRole("region", { name: "Career path infographic" }),
  ).toBeTruthy();
  const user = userEvent.setup();
  const frames = container.querySelectorAll<HTMLDetailsElement>(
    "details.career-branch-frame",
  );
  expect([...frames].map((frame) => frame.open)).toEqual([
    false,
    false,
    false,
    false,
  ]);
  await user.click(screen.getByRole("button", { name: "Continue week 2" }));
  expect(
    (
      screen.getByRole("progressbar", {
        name: "Weeks completed",
      }) as HTMLProgressElement
    ).value,
  ).toBe(1);
  expect(
    await screen.findByRole("link", { name: /Spreadsheet basics/ }),
  ).toBeTruthy();
  expect(screen.getByText("Complete week 2 work.")).toBeTruthy();
  expect(
    screen.getByText("Week 2 introduces a practical data analysis concept."),
  ).toBeTruthy();
  expect(
    screen.getByText("Explain the question a dataset can answer"),
  ).toBeTruthy();
  expect(
    screen.getByText("Read the introduction, then sort your sample table."),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Prepare for an opportunity" }),
  ).toBeTruthy();
  expect(screen.getByText("3/3")).toBeTruthy();
  expect(
    screen.getAllByRole("link", { name: /Junior analyst internship/ })[0],
  ).toBeTruthy();
  await user.click(screen.getByText("Compare listed skills"));
  expect(await screen.findByText("CV · Quiz · Work")).toBeTruthy();
  expect(screen.getByText("No signal")).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Clean a dataset" }).closest("li")
      ?.className,
  ).toContain("is-active");
  expect(
    screen.getByRole("heading", { name: "Explore patterns" }).closest("li")
      ?.className,
  ).toContain("is-locked");
  await user.click(
    screen.getByRole("button", { name: "Ask AI to review this level" }),
  );
  expect(
    await screen.findByText(/Your saved work meets this level/),
  ).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: "Complete level & open next" }),
  );
  expect(onComplete).toHaveBeenCalledWith(2);
  await user.click(screen.getByRole("button", { name: "CV" }));
  expect(location.pathname).toBe("/app/review");
  await user.click(screen.getByRole("button", { name: "Quiz" }));
  expect(location.pathname + location.search).toBe(
    "/app/progress?view=practice",
  );
});

test("keeps real opportunity visible while the preparation quest is locked", async () => {
  vi.mocked(api).mockImplementation((path) => {
    if (path.startsWith("/weeks/"))
      return Promise.resolve({
        week: 3,
        sprint_id: "data-sprint",
        title: "Explore patterns",
        resource: state.plan?.resources?.[0],
        actions: [{ id: "learn", title: "Learn one useful idea", detail: "" }],
        checklist: {},
        evidence_url: "",
        reflection: "",
        learning_note: "",
      });
    if (path === "/me/portfolio") return Promise.resolve([]);
    if (path === "/me/readiness")
      return Promise.resolve({
        practice: null,
        cv_reviewed: false,
        evidence_count: 0,
      });
    if (path === "/me/cv-reviews") return Promise.resolve([]);
    if (path === "/me/assessment") return Promise.resolve(null);
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });
  const { container } = render(
    <CareerPathTree state={state} onComplete={vi.fn(async () => {})} />,
  );
  expect(
    await screen.findByRole("heading", { name: "Prepare for an opportunity" }),
  ).toBeTruthy();
  expect(screen.getByText("0/3")).toBeTruthy();
  expect(
    screen.getAllByRole("link", { name: /Junior analyst internship/ })[0],
  ).toBeTruthy();
  const user = userEvent.setup();
  await user.click(
    container
      .querySelectorAll<HTMLDetailsElement>("details.career-branch-frame")[2]
      .querySelector("summary")!,
  );
  expect(
    ((await screen.findByRole("checkbox")) as HTMLInputElement).disabled,
  ).toBe(true);
  expect(
    (
      screen.getByRole("button", {
        name: /Add a learning note/,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await user.click(screen.getByText("Compare listed skills"));
  expect(screen.getAllByText("No signal")).toHaveLength(2);
});

test("goal without a researched sprint gets an actionable plan-tree start", async () => {
  const goalOnly = { ...state, plan: null };
  render(
    <CareerPathTree state={goalOnly} onComplete={vi.fn(async () => {})} />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Map my first steps" }));
  expect(location.pathname + location.search).toBe("/app/discover?view=plan");
});
