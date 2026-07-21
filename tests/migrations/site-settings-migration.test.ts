import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260721213000_site_settings.sql"),
  "utf8",
);

describe("site settings migration", () => {
  it("enables RLS for every new site-scoped table", () => {
    for (const table of ["site_invitations", "site_domains", "site_export_requests"]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("uses guarded functions for sensitive cross-record changes", () => {
    expect(migration).toContain("function public.update_site_member_access");
    expect(migration).toContain("function public.transfer_site_ownership");
    expect(migration).toContain("function public.set_default_site_language");
    expect(migration).toContain("function public.set_primary_site_domain");
  });

  it("never exposes ownership as an invitation role", () => {
    expect(migration).toContain("role in ('admin', 'publisher', 'editor', 'viewer')");
  });

  it("limits full-site export requests to settings managers", () => {
    expect(migration).toContain('create policy "Settings managers can request exports"');
    expect(migration).toContain("private.can_manage_site_settings(site_id, (select auth.uid()))");
  });

  it("changes unique defaults without transient duplicate values", () => {
    expect(migration).toContain("set is_default = false");
    expect(migration).toContain("set is_default = true");
    expect(migration).toContain("set is_primary = false");
    expect(migration).toContain("set is_primary = true");
  });
});
