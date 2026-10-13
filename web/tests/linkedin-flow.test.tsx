import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import LinkedInBridge from "../src/features/discovery/LinkedInBridge";
import ProcessingProgress from "../src/shared/ui/ProcessingProgress";
vi.mock("../src/shared/api", () => ({ api: vi.fn() }));
import { api } from "../src/shared/api";
test("search respects goal and country; pasted job returns preparation actions", async () => {
  vi.mocked(api).mockResolvedValue({
    supported: ["Linux"],
    gaps: ["Networking"],
    actions: ["Build a fictional network diagram."],
    resources: [],
    notice: "Availability unverified.",
    url: "https://www.linkedin.com/jobs/view/123",
  });
  render(<LinkedInBridge goal="Data centre engineer" market="Rwanda" />);
  const url = new URL(
    screen.getByRole("link", { name: /Search Rwanda/ }).getAttribute("href")!,
  );
  expect(url.searchParams.get("keywords")).toBe("Data centre engineer");
  expect(url.searchParams.get("location")).toBe("Rwanda");
  const user = userEvent.setup();
  await user.click(screen.getByText("Check a job against my skills"));
  await user.type(
    screen.getByLabelText("LinkedIn job link"),
    "https://www.linkedin.com/jobs/view/123",
  );
  await user.type(
    screen.getByLabelText("Paste the job description"),
    "We need an infrastructure technician with Linux and networking skills. This fictional example is for preparation only.",
  );
  await user.click(screen.getByRole("button", { name: /Check my next steps/ }));
  expect(
    await screen.findByText("Build a fictional network diagram."),
  ).toBeTruthy();
  expect(api).toHaveBeenCalledWith(
    "/me/external-job-review",
    expect.objectContaining({ method: "POST" }),
  );
});
test("processing renders explicit animated segment without invented percentage", () => {
  render(<ProcessingProgress label="Creating sprint" detail="Saving" />);
  const bar = screen.getByRole("progressbar", { name: "Creating sprint" });
  expect(bar.querySelector("span")).toBeTruthy();
  expect(bar.getAttribute("aria-valuenow")).toBeNull();
});
