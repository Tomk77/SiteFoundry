import { describe, expect, it } from "vitest";

import {
  accessSummary,
  canManageSettings,
  initialMembers,
} from "@/features/site-settings/site-settings-model";

describe("site settings model", () => {
  it("separates roles from human-readable access scope", () => {
    expect(accessSummary(initialMembers[0]!)).toBe("Full site");
    expect(accessSummary(initialMembers[2]!)).toBe("English and Dutch");
    expect(accessSummary(initialMembers[3]!)).toBe("Blog");
  });

  it("allows only owners and administrators to manage settings", () => {
    expect(canManageSettings("owner")).toBe(true);
    expect(canManageSettings("administrator")).toBe(true);
    expect(canManageSettings("publisher")).toBe(false);
    expect(canManageSettings("viewer")).toBe(false);
  });
});
