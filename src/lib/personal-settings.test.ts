/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

import { applyInterfaceMode } from "./personal-settings";

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-sf-mode");
  document.documentElement.removeAttribute("data-sf-theme");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setSystemTheme(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: dark,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  );
}

describe("applyInterfaceMode", () => {
  it("applies and persists dark mode", () => {
    setSystemTheme(false);

    applyInterfaceMode("dark");

    expect(document.documentElement.dataset.sfMode).toBe("dark");
    expect(document.documentElement.dataset.sfTheme).toBe("dark");
    expect(window.localStorage.getItem("sf-interface-mode")).toBe("dark");
  });

  it("keeps explicit light mode light on a dark system", () => {
    setSystemTheme(true);

    applyInterfaceMode("light");

    expect(document.documentElement.dataset.sfTheme).toBe("light");
  });

  it("follows the operating-system preference in system mode", () => {
    setSystemTheme(true);

    applyInterfaceMode("system");

    expect(document.documentElement.dataset.sfMode).toBe("system");
    expect(document.documentElement.dataset.sfTheme).toBe("dark");
  });
});
