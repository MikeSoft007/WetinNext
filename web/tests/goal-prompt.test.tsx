import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import GoalPrompt from "../src/features/goals/GoalPrompt";
test("goal prompt passes a meaningful goal into the existing profile setup", async () => {
  const onGoal = vi.fn();
  render(<GoalPrompt onGoal={onGoal} />);
  const user = userEvent.setup();
  expect(
    (
      screen.getByRole("button", {
        name: "Build my direction",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await user.type(
    screen.getByRole("textbox", { name: "Your goal today" }),
    "Learn DevOps",
  );
  await user.click(screen.getByRole("button", { name: "Build my direction" }));
  expect(onGoal).toHaveBeenCalledWith("Learn DevOps");
});
