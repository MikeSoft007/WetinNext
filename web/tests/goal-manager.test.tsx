import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import GoalSwitcher from "../src/features/goals/GoalSwitcher";
import type { State } from "../src/shared/types";
import { api } from "../src/shared/api";
vi.mock("../src/shared/api", () => ({ api: vi.fn() }));
test("goal manager requires explicit deletion confirmation", async () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  vi.mocked(api).mockResolvedValue([
    {
      id: "devops",
      goal: "DevOps",
      active: true,
      completed_weeks: 1,
      has_plan: true,
      country: "Nigeria",
    },
  ]);
  const refresh = vi.fn().mockResolvedValue(undefined);
  render(
    <GoalSwitcher
      state={{ profile: { goal: "DevOps" } } as State}
      onAdd={vi.fn()}
      onSwitched={refresh}
    />,
  );
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Manage goals · 1" }),
  );
  await user.click(screen.getByRole("button", { name: "Delete goal: DevOps" }));
  expect(
    screen.getByRole("alertdialog", { name: "Confirm goal deletion" }),
  ).toBeTruthy();
  expect(api).not.toHaveBeenCalledWith("/me/goals/devops", {
    method: "DELETE",
  });
  await user.click(screen.getByRole("button", { name: "Keep goal" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Delete goal: DevOps" }));
  await user.click(screen.getByRole("button", { name: "Delete goal" }));
  expect(api).toHaveBeenCalledWith("/me/goals/devops", { method: "DELETE" });
  expect(refresh).toHaveBeenCalled();
});
