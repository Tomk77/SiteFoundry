// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deliver } from "./delivery";
import { addLanguage, addMember, createOwnerSite, type SiteFixture } from "./fixtures";
import { createMigratedDatabase, type TestDatabase } from "./harness";

let database: TestDatabase;
let site: SiteFixture;

beforeEach(async () => {
  database = await createMigratedDatabase();
  site = await createOwnerSite(database);
}, 120_000);

afterEach(() => database.close());

async function firstType(languageId: string) {
  const [type] = await database.admin<{ id: string; slug: string; version: number }>(
    `select id, slug, published_schema_version as version from public.content_types
     where site_language_id = $1 order by position limit 1`,
    [languageId],
  );

  if (!type) throw new Error("No content type");

  return type;
}

function publishSchema(userId: string, typeId: string) {
  return database.as(
    userId,
    async (tx) =>
      (
        await tx.query<{ version: number }>(
          "select public.publish_content_type_schema($1) as version",
          [typeId],
        )
      ).rows[0]?.version,
  );
}

describe("2.4 content type schemas reach delivery", () => {
  it("publishes the seeded schemas of a new site", async () => {
    const type = await firstType(site.languageId);
    const bundle = await deliver(database, site.ownerId, site.siteId, site.siteSlug);

    expect(type.version).toBeGreaterThan(0);
    expect(bundle.contentTypes.map((item) => item.slug)).toContain(type.slug);
  });

  it("publishes the seeded schemas of a newly added language", async () => {
    const dutch = await addLanguage(database, site.siteId, "nl");

    expect((await firstType(dutch.languageId)).version).toBeGreaterThan(0);
  });

  it("lets a structured-content editor publish a changed schema, and skips unchanged ones", async () => {
    const editorId = await addMember(database, site.siteId, "editor");
    const type = await firstType(site.languageId);

    expect(await publishSchema(editorId, type.id)).toBe(type.version);

    await database.admin(
      `insert into public.content_fields
         (content_type_id, site_language_id, key, label, field_type, position)
       values ($1, $2, 'extraNote', 'Extra note', 'text', 99)`,
      [type.id, site.languageId],
    );

    expect(await publishSchema(editorId, type.id)).toBe(type.version + 1);
  });
});
