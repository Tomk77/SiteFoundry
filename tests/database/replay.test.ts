// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratedDatabase, fixtureSiteSlug, type TestDatabase } from "./harness";

describe("migration replay", () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createMigratedDatabase();
  }, 120_000);

  afterAll(() => database.close());

  it("replays every repository migration on an empty database", async () => {
    const rows = await database.admin<{ status: string }>(
      `select page.status from public.pages page
       join public.site_languages language on language.id = page.site_language_id
       join public.sites site on site.id = language.site_id
       where site.slug = $1 and page.is_homepage and language.code = 'en'`,
      [fixtureSiteSlug],
    );

    expect(rows).toEqual([{ status: "published" }]);
  });
});
