import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { test, expect, vi } from "vitest";
import GoalOpenings from "../src/features/discovery/GoalOpenings";
import { api } from "../src/shared/api";
vi.mock("../src/shared/api", () => ({ api: vi.fn() }));
test("sourced openings link directly and compare required skills with saved evidence", async () => {
  vi.mocked(api).mockImplementation(async (path) =>
    path === "/me/skills"
      ? ({ skills: [{ name: "Linux", evidence_count: 1 }] } as never)
      : ({
          status: "complete",
          result: {
            goal: "DevOps",
            researched_at: "2026-10-14",
            sources: [{ url: "https://example.org/jobs/cloud" }],
            opportunities: [
              {
                title: "Cloud trainee",
                provider: "Employer",
                location: "Kigali",
                type: "job",
                url: "https://example.org/jobs/cloud",
                open_status: "current_open",
                required_skills: ["Linux", "Docker"],
                eligibility: "Check entry requirements",
              },
            ],
          },
        } as never),
  );
  render(<GoalOpenings goal="DevOps" market="Rwanda" refreshVersion={0} />);
  const link = await screen.findByRole("link", {
    name: /View listing & apply/,
  });
  expect(link.getAttribute("href")).toBe("https://example.org/jobs/cloud");
  expect(screen.getByText(/Publication date unknown/)).toBeTruthy();
  await userEvent.click(
    screen.getByRole("button", { name: "Check eligibility against my goal" }),
  );
  expect(screen.getByText("✓ Related saved evidence: Linux")).toBeTruthy();
  expect(screen.getByText("○ Evidence still needed: Docker")).toBeTruthy();
});
