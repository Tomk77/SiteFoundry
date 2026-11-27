// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOwnerSite, type SiteFixture } from "./fixtures";
import { createMigratedDatabase, expectDenied, type TestDatabase } from "./harness";

let database: TestDatabase;
let site: SiteFixture;

beforeEach(async () => {
  database = await createMigratedDatabase();
  site = await createOwnerSite(database);
}, 120_000);

afterEach(() => database.close());

function addLanguage(prefix: string) {
  return database.as(site.ownerId, (tx) =>
    tx.query(
      `insert into public.site_languages (site_id, code, name, url_prefix, position)
       values ($1, 'nl', 'Dutch', $2, 1)`,
      [site.siteId, prefix],
    ),
  );
}

describe("3.2 language URL prefixes have one format", () => {
  it.each(["nl/", "/nl", "NL", "nl/be"])("rejects %j", async (prefix) => {
    await expectDenied(() => addLanguage(prefix));
  });

  it("accepts a bare prefix", async () => {
    await addLanguage("nl-be");
    const rows = await database.admin<{ url_prefix: string }>(
      "select url_prefix from public.site_languages where site_id = $1 and code = 'nl'",
      [site.siteId],
    );

    expect(rows).toEqual([{ url_prefix: "nl-be" }]);
  });
});
