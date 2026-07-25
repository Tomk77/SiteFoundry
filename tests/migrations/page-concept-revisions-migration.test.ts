import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260725143000_page_concept_revisions.sql"),
  "utf8",
).toLowerCase();

describe("page concept revisions migration", () => {
  it("stores every explicit concept save as an immutable revision", () => {
    expect(migration).toContain("create table if not exists public.page_revisions");
    expect(migration).toContain("unique (page_id, version)");
    expect(migration).toContain("add column if not exists concept_revision_id uuid");
    expect(migration).not.toContain("grant update on public.page_revisions");
    expect(migration).not.toContain("grant delete on public.page_revisions");
  });

  it("saves the concept and optional publication in one database transaction", () => {
    expect(migration).toContain("create or replace function public.save_page_revision");
    expect(migration).toContain("expected_concept_revision_id");
    expect(migration).toContain("this page has a newer concept revision");
    expect(migration).toContain("source_concept_revision_id");
    expect(migration).toContain("if should_publish then");
  });

  it("can restore the live snapshot without changing delivery history", () => {
    expect(migration).toContain("create or replace function public.discard_page_concept");
    expect(migration).toContain("published.snapshot ->> 'title'");
    expect(migration).toContain("concept_revision_id = restored_concept_id");
  });
});
