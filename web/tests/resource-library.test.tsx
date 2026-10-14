import { relatedSkill } from "../src/shared/goalComparison";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import ResourceBank from "../src/features/discovery/ResourceBank";
import type { State } from "../src/shared/types";
vi.mock("../src/shared/api", () => ({ api: vi.fn() }));
import { api } from "../src/shared/api";
test("library filters known paid amounts and compares resource skills with recorded goal evidence", async () => {
  const resources = [
    {
      id: "linux",
      title: "Linux practice",
      provider: "Example",
      url: "https://example.org/linux",
      format: "Course",
      device: "laptop",
      cost: "Paid",
      price_amount: 20,
      price_currency: "USD",
      location: "Online",
      review: "Linux exercises",
      skills: ["Linux"],
    },
    {
      id: "unknown",
      title: "Unknown fee course",
      provider: "Example",
      url: "https://example.org/unknown",
      format: "Course",
      device: "laptop",
      cost: "Paid",
      review: "Pricing not verified",
      skills: ["Networking"],
    },
  ];
  vi.mocked(api).mockImplementation(async (path) =>
    path === "/resources"
      ? resources
      : path === "/me/skills"
        ? {
            skills: [
              { name: "Linux", evidence_count: 1, practised_weeks: [1] },
              { name: "Networking", evidence_count: 0, practised_weeks: [] },
            ],
          }
        : path === "/me/cv-reviews"
          ? Promise.reject(new Error("CV history unavailable"))
          : null,
  );
  const state: State = {
    profile: { goal: "Learn DevOps" },
    plan: null,
    progress: {},
    applications: {},
  };
  render(<ResourceBank state={state} market="Rwanda" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "All sources" }));
  await screen.findByText("Linux practice");
  await user.selectOptions(screen.getByLabelText("Pricing"), "paid");
  await user.type(screen.getByLabelText("Minimum price"), "10");
  await user.type(screen.getByLabelText("Maximum price"), "30");
  expect(screen.queryByText("Unknown fee course")).toBeNull();
  await user.click(
    screen.getByRole("button", { name: "Compare with my goal" }),
  );
  const comparison = screen.getByRole("region", {
    name: "Resource goal comparison",
  });
  expect(within(comparison).getByText("Networking")).toBeTruthy();
  expect(within(comparison).getAllByText("Linux").length).toBeGreaterThan(0);
});

test("topic matching does not confuse data centre engineering with data science", () => {
  expect(relatedSkill("Data center engineer", "Data scientist")).toBe(false);
  expect(relatedSkill("Linux", "use Linux operating systems")).toBe(true);
});
