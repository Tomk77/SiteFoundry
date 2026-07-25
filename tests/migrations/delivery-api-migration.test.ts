import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260722200000_delivery_api.sql"),
  "utf8",
).toLowerCase();

describe("delivery API migration", () => {
  it("stores token hashes and immutable published snapshots", () => {
    expect(migration).toContain("create table if not exists public.site_api_tokens");
    expect(migration).toContain("token_hash text not null unique");
    expect(migration).toContain("create table if not exists public.page_published_revisions");
    expect(migration).toContain(
      "create table if not exists public.content_record_published_revisions",
    );
  });

  it("keeps delivery authorization inside the database boundary", () => {
    expect(migration).toContain("create or replace function public.get_delivery_bundle");
    expect(migration).toContain("and token.token_hash = lower(target_token_hash)");
    expect(migration).toContain("and token.revoked_at is null");
    expect(migration).toContain("origin is not allowed for this token");
    expect(migration).toContain("delivery rate limit exceeded");
  });

  it("never grants delivery access to administration tables", () => {
    expect(migration).not.toContain("grant select on public.site_members to anon");
    expect(migration).not.toContain("grant select on public.profiles to anon");
  });
});
