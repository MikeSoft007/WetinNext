import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { test, expect, vi } from "vitest";
import ReadinessCheck from "../src/features/progress/ReadinessCheck";
import type { State } from "../src/shared/types";
vi.mock("../src/shared/api", () => ({ api: vi.fn() }));
import { api } from "../src/shared/api";
test("practice is submitted to server and never labelled qualified", async () => {
  const attempt = {
    id: "attempt",
    title: "Introductory practice",
    completed: false,
    questions: [0, 1, 2, 3].map((i) => ({
      prompt: `Concept ${i}?`,
      options: ["A", "B", "C", "D"],
    })),
  };
  const readiness = {
    goal: "Learn nursing",
    practice: null,
    cv_reviewed: false,
    evidence_count: 0,
    qualification_status: "Not verified",
    eligibility_status: "Confirm each opportunity",
    notice: "Practice is not a qualification.",
  };
  vi.mocked(api).mockImplementation(async (path, init) =>
    path === "/me/readiness"
      ? readiness
      : path === "/me/assessment"
        ? init?.method === "POST"
          ? attempt
          : null
        : {
            ...attempt,
            completed: true,
            result: {
              correct: 3,
              total: 4,
              notice: "Practice only",
              feedback: attempt.questions.map(() => ({
                correct: true,
                answer: "A",
                explanation: "Review the theory.",
                source: { url: "https://example.edu", title: "Source" },
              })),
            },
          },
  );
  render(
    <ReadinessCheck
      state={
        {
          profile: { goal: "Learn nursing" },
          plan: {
            id: "plan",
            research_id: "research",
            title: "Nursing",
            outcome: "Theory",
            weeks: [],
            engine: "OpenAI",
            notice: "Theory only",
          },
          progress: {},
          applications: {},
        } as State
      }
    />,
  );
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: /Start 4-question practice/ }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Mark for review" }),
  );
  expect(
    screen
      .getByRole("button", { name: "Marked for review" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(
    screen.getByRole("button", { name: "Review marked · 1" }),
  ).toBeTruthy();
  for (let i = 0; i < 4; i++) {
    await user.click(
      within(
        await screen.findByRole("group", { name: `${i + 1}. Concept ${i}?` }),
      ).getByRole("radio", { name: /^A/ }),
    );
    if (i < 3)
      await user.click(screen.getByRole("button", { name: "Next question" }));
  }
  await user.click(screen.getByRole("button", { name: "Check my answers" }));
  expect(
    await screen.findByText("3 of 4 correct · Practice only"),
  ).toBeTruthy();
  expect(screen.getByText(/Qualifications: Not verified/)).toBeTruthy();
});

test("custom question count and difficulty reach the API and progress follows the set", async () => {
  const ready = { practice: null, evidence_count: 0, cv_reviewed: false };
  vi.mocked(api).mockImplementation(async (path, init) => {
    if (path === "/me/readiness") return ready;
    if (path === "/me/assessment" && init?.method === "POST") {
      const settings = JSON.parse(String(init.body));
      return {
        id: "custom",
        title: "Intermediate anatomy practice",
        difficulty: settings.difficulty,
        completed: false,
        questions: Array.from({ length: settings.question_count }, (_, i) => ({
          prompt: `Concept ${i + 1}`,
          options: ["First", "Second", "Third", "Fourth"],
        })),
      };
    }
    return null;
  });
  render(
    <ReadinessCheck
      state={
        {
          profile: { goal: "Learn nursing" },
          plan: { research_id: "research" },
          progress: {},
          applications: {},
        } as State
      }
    />,
  );
  const user = userEvent.setup();
  await user.clear(
    screen.getByRole("spinbutton", { name: "Number of questions" }),
  );
  await user.type(
    screen.getByRole("spinbutton", { name: "Number of questions" }),
    "6",
  );
  await user.click(screen.getByRole("radio", { name: /Intermediate/ }));
  await user.click(
    screen.getByRole("button", { name: "Start 6-question practice" }),
  );
  expect(api).toHaveBeenCalledWith("/me/assessment", {
    method: "POST",
    body: JSON.stringify({
      question_count: 6,
      difficulty: "intermediate",
      time_limit_minutes: 10,
    }),
  });
  expect(await screen.findByText("Question 1 of 6")).toBeTruthy();
  await user.click(screen.getByRole("radio", { name: /First/ }));
  expect(
    screen
      .getByRole("progressbar", { name: "Questions answered" })
      .getAttribute("aria-valuenow"),
  ).toBe("1");
  await user.click(screen.getByRole("button", { name: "Go to question 6" }));
  expect(
    screen
      .getByRole("button", { name: "Check my answers" })
      .hasAttribute("disabled"),
  ).toBe(true);
});

test("practice entry stays actionable before a researched plan is saved", async () => {
  vi.mocked(api).mockImplementation(async (path) =>
    path === "/me/readiness"
      ? { practice: null, evidence_count: 0, cv_reviewed: false }
      : path === "/me/assessment"
        ? null
        : null,
  );
  render(
    <ReadinessCheck
      state={
        {
          profile: { goal: "Learn nursing" },
          plan: null,
          progress: {},
          applications: {},
        } as State
      }
    />,
  );
  const button = await screen.findByRole("button", {
    name: "Build my researched plan",
  });
  expect(button.hasAttribute("disabled")).toBe(false);
  await userEvent.setup().click(button);
  expect(location.pathname).toBe("/app/discover");
  expect(new URLSearchParams(location.search).get("view")).toBe("plan");
});

test("expired timed practice locks answers and allows submitting unanswered questions", async () => {
  const attempt = {
    id: "timed",
    title: "Timed practice",
    completed: false,
    time_limit_minutes: 5,
    expires_at: "2020-01-01T00:00:00Z",
    questions: [{ prompt: "Concept?", options: ["A", "B", "C", "D"] }],
  };
  vi.mocked(api).mockImplementation(async (path) =>
    path === "/me/assessment" ? attempt : { practice: null, evidence_count: 0 },
  );
  render(
    <ReadinessCheck
      state={
        {
          profile: { goal: "Learn nursing" },
          plan: { research_id: "research" },
          progress: {},
          applications: {},
        } as State
      }
    />,
  );
  expect(await screen.findByText(/Time’s up/)).toBeTruthy();
  expect(
    screen.getByRole("timer", { name: "Time remaining" }).textContent,
  ).toContain("00:00");
  expect(
    screen.getByRole("group", { name: "1. Concept?" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen
      .getByRole("button", { name: "Check my answers" })
      .hasAttribute("disabled"),
  ).toBe(false);
});

test("feedback compares selected and correct answers with a clean specific lesson link", async () => {
  const attempt = {
    id: "review",
    title: "Anatomy practice",
    completed: true,
    questions: [
      {
        prompt: "What is homeostasis?",
        options: [
          "A changing balance",
          "Stable internal conditions",
          "An organ",
          "A tissue",
        ],
      },
    ],
    result: {
      correct: 0,
      total: 1,
      feedback: [
        {
          correct: false,
          selected_answer: "An organ",
          answer: "Stable internal conditions",
          explanation:
            "Homeostasis maintains relatively stable internal conditions.",
          source: {
            title: "Homeostasis lesson",
            url: "https://openstax.org/books/anatomy-and-physiology-2e/pages/1-5-homeostasis?utm_source=openai",
            specific_reference: true,
          },
        },
      ],
    },
  };
  vi.mocked(api).mockImplementation(async (path) =>
    path === "/me/assessment"
      ? attempt
      : { practice: { correct: 0, total: 1 }, evidence_count: 0 },
  );
  render(
    <ReadinessCheck
      state={
        {
          profile: { goal: "Learn nursing" },
          plan: { research_id: "research" },
          progress: {},
          applications: {},
        } as State
      }
    />,
  );
  expect(await screen.findByText("An organ")).toBeTruthy();
  expect(screen.getByText("Stable internal conditions")).toBeTruthy();
  expect(screen.getByText("YOUR ANSWER")).toBeTruthy();
  expect(screen.getByText("CORRECT ANSWER")).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: /Homeostasis lesson/ })
      .getAttribute("href"),
  ).toBe(
    "https://openstax.org/books/anatomy-and-physiology-2e/pages/1-5-homeostasis",
  );
});
