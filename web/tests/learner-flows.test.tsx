import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingModal } from "../src/features/goals/OnboardingModal";
import CVWorkspace from "../src/features/cv/CVWorkspace";
import WeekWorkbench, {
  EvidencePortfolio,
} from "../src/features/learning/WeekWorkbench";
import TodayRecoveryActions from "../src/features/learning/TodayRecoveryActions";
import type { Profile } from "../src/shared/types";
import { api } from "../src/shared/api";
vi.mock("../src/shared/api", () => ({ api: vi.fn() }));
const request = vi.mocked(api);
const profile: Profile = {
  name: "Journey",
  goal: "Prepare for a frontend internship",
  country: "Nigeria",
  learner_type: "student",
  hours: 3,
  device: "laptop",
  background: "HTML",
  low_data: true,
  career_track: "frontend",
};
beforeEach(() => {
  request.mockReset();
});

describe("Goal setup", () => {
  it("creates a starting plan in two steps and keeps optional preferences available", async () => {
    const submit = vi.fn((e: { preventDefault: () => void }) =>
      e.preventDefault(),
    );
    function Setup() {
      const [value, setValue] = useState(profile);
      return (
        <OnboardingModal
          profile={value}
          setProfile={setValue}
          busy={false}
          error=""
          onClose={() => {}}
          onSubmit={submit}
        />
      );
    }
    render(<Setup />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Your career or learning goal"));
    await user.type(
      screen.getByLabelText("Your career or learning goal"),
      "Find a data internship",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByRole("heading", { name: "Make room for your next step." }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Find a data internship" }),
    ).toBeTruthy();
    expect(screen.getByText("Personalise your recommendations")).toBeTruthy();
    expect(
      screen
        .getByText("Personalise your recommendations")
        .closest("details")
        ?.hasAttribute("open"),
    ).toBe(false);
    await user.click(screen.getByText("Personalise your recommendations"));
    expect(
      screen.getByLabelText("What do you already know? (optional)"),
    ).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Create my first sprint" }),
    );
    expect(submit).toHaveBeenCalledOnce();
  });
  it("shows an animated creation state while saving without pretending completion", () => {
    render(
      <OnboardingModal
        profile={profile}
        setProfile={() => {}}
        busy
        error=""
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Making room for your ambition.",
    );
    expect(
      screen
        .getByRole("button", { name: "Saving your starting plan…" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});

const review = {
  id: "review-1",
  filename: "sample.txt",
  created_at: "2026-10-12T10:00:00Z",
  goal: "Frontend internship",
  opportunity_title: null,
  skills: ["HTML"],
  sections: {
    Education: true,
    Projects: true,
    Skills: true,
    Experience: false,
  },
  supported: [],
  gaps: [],
  actions: [
    {
      priority: "High",
      title: "Explain your project contribution",
      detail: "Describe what you built and checked.",
    },
  ],
  word_count: 35,
  notice: "Unverified skill mentions.",
  extracted_preview: "Synthetic learner CV.",
  suggested_resources: [],
};
function cvApi(upload?: () => Promise<unknown>) {
  request.mockImplementation(async (path, init) => {
    if (path === "/me") return { profile };
    if (path === "/me/cv-reviews" && init?.method === "POST")
      return upload ? upload() : review;
    if (path === "/me/cv-reviews") return [];
    if (path.startsWith("/me/cv-reviews?"))
      return { items: [], total: 0, page: 1, pages: 1, page_size: 6 };
    if (path.startsWith("/opportunities")) return [];
    throw Error("Unexpected request " + path);
  });
}
async function chooseCV() {
  const user = userEvent.setup();
  await screen.findByRole("button", { name: "Find my next steps" });
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Find my next steps" })
        .hasAttribute("disabled"),
    ).toBe(true),
  );
  const file = new File(
    ["Synthetic CV with education, HTML projects and university experience."],
    "sample.txt",
    { type: "text/plain" },
  );
  Object.defineProperty(file, "arrayBuffer", {
    value: async () =>
      new TextEncoder().encode(
        "Synthetic CV with education, HTML projects and university experience.",
      ).buffer,
  });
  await user.upload(screen.getByLabelText("CV document"), file);
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Find my next steps" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  return user;
}

describe("CV journey", () => {
  it("uploads a selected document, shows checking, and opens the saved actions", async () => {
    let resolve!: (value: unknown) => void;
    cvApi(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    render(<CVWorkspace />);
    expect(
      screen.getByText(/original file is not retained or sent to OpenAI/i),
    ).toBeTruthy();
    expect(screen.queryByText("Evidence-led feedback")).toBeNull();
    const user = await chooseCV();
    expect(
      (screen.getByLabelText("Your target role or goal") as HTMLInputElement)
        .value,
    ).toBe(profile.goal);
    await user.click(
      screen.getByRole("button", { name: "Find my next steps" }),
    );
    await screen.findByRole("heading", { name: "Reviewing your CV" });
    resolve(review);
    await screen.findByRole("heading", { name: "Your review" });
    expect(screen.getByText("Explain your project contribution")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Explore my matches" })
        .getAttribute("href"),
    ).toBe("/app/discover");
    const payload = JSON.parse(
      String(
        request.mock.calls.find(
          ([path, init]) =>
            path === "/me/cv-reviews" && init?.method === "POST",
        )![1]!.body,
      ),
    );
    expect(atob(payload.content_base64)).toContain("Synthetic CV");
  });
  it("keeps the selected file and focus available after an extraction failure", async () => {
    cvApi(async () => {
      throw Error("Scanned PDFs need OCR.");
    });
    render(<CVWorkspace />);
    const user = await chooseCV();
    await user.click(
      screen.getByRole("button", { name: "Find my next steps" }),
    );
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("OCR");
    expect(
      screen
        .getByRole("button", { name: "Find my next steps" })
        .hasAttribute("disabled"),
    ).toBe(false);
    expect(screen.getByText("sample.txt")).toBeTruthy();
  });
});

it("saves action ticks separately from unsaved evidence, then saves the evidence explicitly", async () => {
  const work = {
    week: 1,
    sprint_id: "sprint-1",
    title: "First project",
    resource: {
      id: "mdn-web",
      title: "MDN HTML Guide",
      provider: "MDN",
      url: "https://developer.mozilla.org/en-US/docs/Learn",
      format: "Text",
      device: "laptop",
      cost: "Free",
      review: "Authoritative reference.",
      sample_exercise: "Create a page with headings and useful links.",
    },
    actions: [
      {
        id: "learn",
        title: "Learn one idea",
        detail: "Read an introductory section.",
      },
    ],
    checklist: {},
    evidence_url: "",
    reflection: "",
  };
  request.mockImplementation(async (_path, init) =>
    init?.method === "PUT"
      ? { ...work, ...JSON.parse(String(init.body)) }
      : work,
  );
  render(
    <WeekWorkbench
      week={{
        week: 1,
        title: "First project",
        task: "Build a page",
        success: "A working page",
        resource_id: "mdn-web",
        minutes: 60,
      }}
      planId="sprint-1"
    />,
  );
  const user = userEvent.setup();
  await screen.findByRole("checkbox");
  expect(screen.getByText("A working page")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: /Add a learning note/ }),
  ).toBeTruthy();
  expect(screen.queryByLabelText("ONE IDEA TO KEEP")).toBeNull();
  await user.click(screen.getByRole("button", { name: /Add a learning note/ }));
  expect(screen.getByLabelText("ONE IDEA TO KEEP")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("ONE IDEA TO KEEP"), {
    target: { value: "I learned to use semantic headings." },
  });
  await user.click(screen.getByRole("button", { name: "Collapse note" }));
  expect(screen.queryByLabelText("ONE IDEA TO KEEP")).toBeNull();
  expect(screen.getByText("I learned to use semantic headings.")).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: /I learned to use semantic headings/ }),
  );
  expect(
    screen.getAllByText(/Create a page with headings and useful links/).length,
  ).toBeGreaterThan(0);
  expect(screen.queryByText("YOUR EXAMPLE")).toBeNull();
  expect(screen.queryByText("NEXT QUESTION")).toBeNull();
  await user.click(screen.getByRole("checkbox"));
  await waitFor(() =>
    expect(request.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
      true,
    ),
  );
  const first = JSON.parse(
    String(
      request.mock.calls.find(([, init]) => init?.method === "PUT")![1]!.body,
    ),
  );
  expect(first.reflection).toBe("");
  expect(first.checklist.learn).toBe(true);
  await screen.findByText("Action saved.");
  await user.click(screen.getByRole("button", { name: "Save note" }));
  await screen.findByText("Your evidence is saved.");
  const saves = request.mock.calls.filter(([, init]) => init?.method === "PUT");
  const saved = JSON.parse(String(saves.at(-1)![1]!.body));
  expect(saved.reflection).toBe("I learned to use semantic headings.");
  expect(saved.learning_note).toBe("I learned to use semantic headings.");
  expect(saved.practice_example).toBe("");
  expect(saved.open_question).toBe("");
  expect(screen.queryByLabelText("ONE IDEA TO KEEP")).toBeNull();
  expect(
    screen.getByRole("button", { name: /I learned to use semantic headings/ }),
  ).toBeTruthy();
});

it("shows saved learning notes as a visual evidence board", async () => {
  request.mockResolvedValue([
    {
      week: 1,
      checklist: { learn: true, build: true },
      evidence_url: "https://example.com/project",
      reflection: "Legacy reflection",
      learning_note: "I learned to use semantic headings.",
      practice_example: "I built a page with a navigation link.",
      open_question: "When should I use an ordered list?",
      updated_at: "2026-10-13T12:00:00Z",
    },
  ]);
  render(
    <EvidencePortfolio
      state={{
        profile,
        plan: {
          title: "Web foundations",
          outcome: "Build a page",
          weeks: [
            {
              week: 1,
              title: "Semantic page structure",
              task: "Build a page",
              success: "Working page",
              resource_id: "mdn-web",
              minutes: 60,
            },
          ],
          engine: "test",
          notice: "",
        },
        progress: {},
        applications: {},
      }}
    />,
  );
  expect(await screen.findByText("Semantic page structure")).toBeTruthy();
  expect(screen.getByText("I learned to use semantic headings.")).toBeTruthy();
  expect(
    screen.getByText("I built a page with a navigation link."),
  ).toBeTruthy();
  expect(screen.getByText("When should I use an ordered list?")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open my work" })).toBeTruthy();
});

it("offers task completion and recovery choices beside the current task", async () => {
  const checkIn = vi.fn(),
    adjust = vi.fn(),
    discover = vi.fn(),
    noteChange = vi.fn();
  render(
    <TodayRecoveryActions
      busy={false}
      note=""
      onNoteChange={noteChange}
      onCheckIn={checkIn}
      onAdjust={adjust}
      onDiscover={discover}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "I finished this" }));
  await user.click(
    screen.getByRole("button", { name: "I’m finding it tricky" }),
  );
  await user.click(screen.getByRole("button", { name: "I need more time" }));
  await user.click(
    screen.getByRole("button", { name: /Make this fit my week/ }),
  );
  await user.click(
    screen.getByRole("button", { name: /Find another learning resource/ }),
  );
  expect(checkIn.mock.calls.map(([status]) => status)).toEqual([
    "done",
    "stuck",
    "more-time",
  ]);
  expect(adjust).toHaveBeenCalledOnce();
  expect(discover).toHaveBeenCalledOnce();
  await user.type(
    screen.getByLabelText("How is it going? (optional)"),
    "I started the first section.",
  );
  expect(noteChange).toHaveBeenCalled();
});
