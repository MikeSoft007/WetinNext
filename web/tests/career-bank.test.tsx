import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import CareerBank from "../src/features/discovery/CareerBank";
vi.mock("../src/shared/api", () => ({ api: vi.fn() }));
test("career bank presents applications rather than occupation definitions", () => {
  render(<CareerBank />);
  expect(screen.getByRole("button", { name: "Refresh openings" })).toBeTruthy();
  expect(
    screen.getByRole("region", { name: "Openings for my goal" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("textbox", { name: "Search career bank" }),
  ).toBeNull();
});
