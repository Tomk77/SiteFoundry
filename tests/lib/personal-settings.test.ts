/** @vitest-environment jsdom */

import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseMock, mockResult } from "../helpers/supabase-mock";
import {
  applyInterfaceMode,
  changePassword,
  loadPersonalSettings,
  savePersonalSettings,
  usesPasswordAuthentication,
  type PersonalSettings,
} from "@/lib/personal-settings";
import { getSupabaseBrowserClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: vi.fn(),
  getSupabaseConfigError: () => new Error("Supabase is not configured."),
}));

const user = {
  id: "user-1",
  email: "tom@example.com",
  user_metadata: { full_name: "Tom Klein" },
  app_metadata: { provider: "email", providers: ["email", "google"] },
} as unknown as User;

const settings: PersonalSettings = {
  firstName: " Tom ",
  lastName: " Klein ",
  email: "new@example.com",
  displayName: " Tom K. ",
  interfaceLanguage: "nl",
  interfaceMode: "dark",
};

beforeEach(() => {
  vi.clearAllMocks();
});

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

describe("personal settings persistence", () => {
  it("loads stored profile values", async () => {
    const { client } = createSupabaseMock({
      tables: {
        profiles: [
          mockResult({
            first_name: "Thomas",
            last_name: "Klein",
            display_name: "Tom",
            full_name: "Thomas Klein",
            interface_language: "nl",
            interface_mode: "light",
          }),
        ],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(loadPersonalSettings(user)).resolves.toEqual({
      firstName: "Thomas",
      lastName: "Klein",
      email: "tom@example.com",
      displayName: "Tom",
      interfaceLanguage: "nl",
      interfaceMode: "light",
    });
  });

  it("falls back to user metadata, email, and system preferences", async () => {
    const { client } = createSupabaseMock({ tables: { profiles: [mockResult(null)] } });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(loadPersonalSettings(user)).resolves.toMatchObject({
      firstName: "Tom",
      lastName: "Klein",
      displayName: "Tom Klein",
      interfaceLanguage: "en",
      interfaceMode: "system",
    });

    const emailUser = {
      ...user,
      email: "editor@example.com",
      user_metadata: {},
    } as unknown as User;
    const second = createSupabaseMock({ tables: { profiles: [mockResult(null)] } });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(second.client as never);
    await expect(loadPersonalSettings(emailUser)).resolves.toMatchObject({
      firstName: "editor",
      lastName: "",
      displayName: "editor",
    });
  });

  it("updates changed email, profile metadata, and interface mode", async () => {
    setSystemTheme(false);
    const { client, auth, calls } = createSupabaseMock({
      tables: { profiles: [mockResult(null)] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(savePersonalSettings(user, settings)).resolves.toEqual({
      emailConfirmationPending: true,
    });
    expect(auth.updateUser).toHaveBeenNthCalledWith(1, { email: "new@example.com" });
    expect(auth.updateUser).toHaveBeenNthCalledWith(2, { data: { full_name: "Tom K." } });
    expect(calls).toContainEqual({
      method: "update",
      args: [
        {
          first_name: "Tom",
          last_name: "Klein",
          display_name: "Tom K.",
          full_name: "Tom Klein",
          interface_language: "nl",
          interface_mode: "dark",
        },
      ],
    });
    expect(document.documentElement.dataset.sfTheme).toBe("dark");
  });

  it("does not request an email change when only casing differs", async () => {
    setSystemTheme(false);
    const { client, auth } = createSupabaseMock({ tables: { profiles: [mockResult(null)] } });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(
      savePersonalSettings(user, { ...settings, email: "TOM@example.com", displayName: "" }),
    ).resolves.toEqual({ emailConfirmationPending: false });
    expect(auth.updateUser).toHaveBeenCalledOnce();
    expect(auth.updateUser).toHaveBeenCalledWith({ data: { full_name: "Tom Klein" } });
  });

  it("verifies the current password before changing it", async () => {
    const { client, auth } = createSupabaseMock();
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    await expect(
      changePassword({
        email: "tom@example.com",
        currentPassword: "old-password",
        newPassword: "new-password",
      }),
    ).resolves.toBeUndefined();
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "tom@example.com",
      password: "old-password",
    });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "new-password" });
  });

  it("reports authentication and database errors", async () => {
    const signIn = createSupabaseMock();
    signIn.auth.signInWithPassword.mockResolvedValueOnce(mockResult(null, new Error("bad login")));
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(signIn.client as never);
    await expect(
      changePassword({ email: "tom@example.com", currentPassword: "bad", newPassword: "new" }),
    ).rejects.toThrow("current password is incorrect");

    const profile = createSupabaseMock({
      tables: { profiles: [mockResult(null, new Error("profile failed"))] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(profile.client as never);
    await expect(loadPersonalSettings(user)).rejects.toThrow("profile failed");
  });

  it("detects password authentication from provider metadata", () => {
    expect(usesPasswordAuthentication(user)).toBe(true);
    expect(
      usesPasswordAuthentication({
        ...user,
        app_metadata: { provider: "google" },
      } as unknown as User),
    ).toBe(false);
  });

  it("rejects operations without a configured client", async () => {
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(null);
    await expect(loadPersonalSettings(user)).rejects.toThrow("not configured");
  });
});
