import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import LearningBranches from "../src/features/goals/LearningBranches";
vi.mock("../src/shared/api", () => ({ api: vi.fn() }));
import { api } from "../src/shared/api";
test("adds and completes a persistent optional branch", async () => {
  const branch = {
    id: "branch",
    title: "Anatomy practice",
    task: "Label a diagram",
    completed: false,
    resource: null,
  };
  vi.mocked(api).mockImplementation(async (_, init) =>
    init?.method === "POST"
      ? branch
      : init?.method === "PATCH"
        ? { ...branch, completed: true }
        : [],
  );
  render(<LearningBranches planId="nursing-plan" resources={[]} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Add learning branch" }));
  await user.type(screen.getByLabelText("Skill or topic"), branch.title);
  await user.type(screen.getByLabelText("One practice task"), branch.task);
  await user.click(screen.getByRole("button", { name: "Grow this branch" }));
  expect(await screen.findByText(branch.title)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Mark complete" }));
  expect(
    await screen.findByRole("button", { name: "Completed · undo" }),
  ).toBeTruthy();
  expect(api).toHaveBeenCalledWith(
    "/me/branches/branch",
    expect.objectContaining({ method: "PATCH", body: '{"completed":true}' }),
  );
});
