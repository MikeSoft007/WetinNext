import { test, expect, vi } from "vitest";
import { navigateApp } from "../src/app/useSectionRoute";
test("response tab URL updates preserve scroll while page navigation resets it", () => {
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  navigateApp("/app/discover?view=nearby", { preserveScroll: true });
  expect(location.search).toBe("?view=nearby");
  expect(scroll).not.toHaveBeenCalled();
  navigateApp("/app/progress");
  expect(scroll).toHaveBeenCalledWith(0, 0);
  scroll.mockRestore();
});
