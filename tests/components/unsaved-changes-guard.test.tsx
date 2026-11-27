import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBlocker } from "@tanstack/react-router";

import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";

vi.mock("@tanstack/react-router", () => ({ useBlocker: vi.fn() }));

afterEach(cleanup);

type BlockerOptions = { shouldBlockFn: () => boolean; enableBeforeUnload: () => boolean };

function blocker(status: "idle" | "blocked") {
  const controls = { status, proceed: vi.fn(), reset: vi.fn() };
  vi.mocked(useBlocker).mockReturnValue(controls as never);

  return controls;
}

function options() {
  return vi.mocked(useBlocker).mock.calls.at(-1)?.[0] as unknown as BlockerOptions;
}

describe("UnsavedChangesGuard (5.2)", () => {
  it("blocks navigation and page unload only while there are unsaved changes", () => {
    blocker("idle");
    const view = render(<UnsavedChangesGuard dirty={false} />);
    expect(options().shouldBlockFn()).toBe(false);
    expect(options().enableBeforeUnload()).toBe(false);

    view.rerender(<UnsavedChangesGuard dirty />);
    expect(options().shouldBlockFn()).toBe(true);
    expect(options().enableBeforeUnload()).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks before leaving and lets the user stay or leave", () => {
    const controls = blocker("blocked");
    render(<UnsavedChangesGuard dirty />);

    expect(screen.getByText("Leave without saving?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    expect(controls.reset).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(controls.proceed).toHaveBeenCalled();
  });
});
