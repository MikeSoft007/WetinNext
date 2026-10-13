import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import TrainingMap from "../src/features/discovery/TrainingMap";
test("regional map loads automatically and campus links stay explicit searches", async () => {
  render(
    <TrainingMap
      location="Kigali, Rwanda"
      places={[{ name: "Example Nursing School", location: "Kigali" }]}
    />,
  );
  const frame = screen.getByTitle("Regional map: Kigali, Rwanda");
  expect(frame.getAttribute("src")).toContain(
    "openstreetmap.org/export/embed.html",
  );
  expect(frame.getAttribute("src")).toContain("29.95");
  expect(
    screen
      .getByRole("link", { name: /Example Nursing School/ })
      .getAttribute("href"),
  ).toContain("maps/search");
  expect(screen.getByText(/Confirm each campus/)).toBeTruthy();
});

test("Nigeria and Global override a previous city scope", () => {
  const { rerender } = render(
    <TrainingMap location="Kigali, Rwanda" market="Nigeria" places={[]} />,
  );
  expect(screen.getByTitle(/Regional map/).getAttribute("src")).toContain(
    "2.5",
  );
  rerender(
    <TrainingMap location="Kigali, Rwanda" market="Global" places={[]} />,
  );
  expect(screen.getByTitle(/Regional map/).getAttribute("src")).toContain(
    "-180",
  );
});
