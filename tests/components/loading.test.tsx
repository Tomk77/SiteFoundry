import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AppShellSkeleton,
  InlineSpinner,
  LoadingBar,
  LoadingDots,
  LoadingSplash,
  RouteLoading,
} from "@/components/loading";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("loading states", () => {
  it("cycles custom splash messages and restores the default list for an empty input", () => {
    vi.useFakeTimers();
    const view = render(<LoadingSplash messages={["First", "Second"]} />);
    expect(screen.getByText("First")).toBeTruthy();
    void act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByText("Second")).toBeTruthy();
    view.unmount();

    render(<LoadingSplash messages={[]} />);
    expect(screen.getByTestId("loading-splash").getAttribute("role")).toBe("status");
  });

  it("renders tree and table application skeletons", () => {
    const { rerender } = render(
      <AppShellSkeleton active="structured-content" label="Loading pages" variant="tree" />,
    );
    expect(screen.getByTestId("tree-skeleton").getAttribute("aria-label")).toBe("Loading pages");

    rerender(<AppShellSkeleton active="media" label="Loading media" variant="table" />);
    expect(screen.getByTestId("table-skeleton").getAttribute("aria-label")).toBe("Loading media");
  });

  it("renders route and inline loading primitives", () => {
    const view = render(<RouteLoading title="Loading template" detail="Fetching fields" />);
    expect(screen.getByText("Loading template")).toBeTruthy();
    expect(screen.getByText("Fetching fields")).toBeTruthy();
    view.rerender(<RouteLoading title="Loading template" />);
    expect(screen.queryByText("Fetching fields")).toBeNull();

    view.rerender(
      <>
        <InlineSpinner small />
        <InlineSpinner />
        <LoadingDots />
        <LoadingBar />
      </>,
    );
    expect(view.container.querySelector(".sc-inline-spinner.small")).toBeTruthy();
    expect(view.container.querySelectorAll(".sc-loading-dots i")).toHaveLength(3);
    expect(view.container.querySelector(".sc-loading-bar i")).toBeTruthy();
  });
});
