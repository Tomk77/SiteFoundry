import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SiteFoundryToaster } from "@/components/ui/sonner";

const toaster = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="toaster" data-position={String(props.position)} />
));

vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => toaster(props),
}));

describe("SiteFoundryToaster", () => {
  it("configures the global notification surface", () => {
    render(<SiteFoundryToaster />);
    expect(toaster).toHaveBeenCalledWith(
      expect.objectContaining({
        position: "bottom-right",
        visibleToasts: 4,
        duration: 3600,
      }),
    );
    const props = toaster.mock.calls[0]![0] as unknown as {
      icons: Record<string, React.ReactNode>;
      toastOptions: { classNames: Record<string, string> };
    };
    expect(Object.keys(props.icons)).toEqual(["success", "info", "warning", "error", "loading"]);
    expect(props.toastOptions.classNames.toast).toBe("sf-toast");
  });
});
