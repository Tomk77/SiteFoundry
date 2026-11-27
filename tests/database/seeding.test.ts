// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addLanguage, createOwnerSite, type SiteFixture } from "./fixtures";
import { createMigratedDatabase, type TestDatabase } from "./harness";

let database: TestDatabase;
let site: SiteFixture;

beforeEach(async () => {
  database = await createMigratedDatabase();
  site = await createOwnerSite(database);
}, 120_000);

afterEach(() => database.close());

describe("4.4 new languages are not seeded with demo people", () => {
  it("creates the starter content types without any records", async () => {
    const dutch = await addLanguage(database, site.siteId, "nl");
    const [row] = await database.admin<{ types: number; records: number }>(
      `select (select count(*)::int from public.content_types where site_language_id = $1) as types,
              (select count(*)::int from public.content_records where site_language_id = $1) as records`,
      [dutch.languageId],
    );

    expect(row).toEqual({ types: 5, records: 0 });
  });

  it("does not seed demo people into a new site either", async () => {
    const [row] = await database.admin<{ records: number }>(
      "select count(*)::int as records from public.content_records where site_language_id = $1",
      [site.languageId],
    );

    expect(row?.records).toBe(0);
  });
});
