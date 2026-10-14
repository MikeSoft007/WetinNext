import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { test, expect, vi } from "vitest";
import ContinueLearning from "../src/features/learning/ContinueLearning";
import { api } from "../src/shared/api";
import type { State } from "../src/shared/types";
vi.mock("../src/shared/api", () => ({ api: vi.fn() }));
test("saved learning returns on Today and records reading progress", async () => {
  const pick = {
    id: "saved",
    title: "Anatomy basics",
    url: "https://example.edu/anatomy",
    provider: "University",
    format: "Text",
    skill: "Anatomy",
    status: "saved",
    updated_at: "2026-10-13T12:00:00Z",
  };
  vi.mocked(api).mockImplementation(async (_, init) =>
    init?.method === "PATCH"
      ? { ...pick, ...JSON.parse(String(init.body)) }
      : [pick],
  );
  render(
    <ContinueLearning
      state={
        { profile: { goal: "Learn nursing" }, goal_id: "nursing" } as State
      }
      market="Rwanda"
    />,
  );
  const user = userEvent.setup();
  await screen.findByRole("heading", { name: "Pick up where you left off" });
  await user.click(screen.getByRole("button", { name: "Mark read" }));
  expect(api).toHaveBeenCalledWith("/me/learning-picks/saved", {
    method: "PATCH",
    body: JSON.stringify({ status: "read" }),
  });
  expect(await screen.findByText("1/1 read")).toBeTruthy();
  expect(api).toHaveBeenCalledWith("/me/learning-picks?market=Rwanda");
});
