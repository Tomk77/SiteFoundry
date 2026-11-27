// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deliver, publishPage } from "./delivery";
import { addMember, addPage, createOwnerSite, type SiteFixture } from "./fixtures";
import { createMigratedDatabase, expectDenied, type TestDatabase } from "./harness";

let database: TestDatabase;
let site: SiteFixture;

beforeEach(async () => {
  database = await createMigratedDatabase();
  site = await createOwnerSite(database);
}, 120_000);

afterEach(() => database.close());

const bundle = () => deliver(database, site.ownerId, site.siteId, site.siteSlug);

async function publishedRecordType() {
  const [type] = await database.admin<{ id: string; slug: string }>(
    "select id, slug from public.content_types where site_language_id = $1 order by position limit 1",
    [site.languageId],
  );

  if (!type) throw new Error("No content type");
  await database.as(site.ownerId, (tx) =>
    tx.query("select public.publish_content_type_schema($1)", [type.id]),
  );

  return type;
}

describe("2.1 unpublishing pages", () => {
  it("removes an unpublished page from delivery and keeps its concept", async () => {
    const about = await addPage(database, site.languageId, site.homepageId, "about");

    await publishPage(database, site.ownerId, about, "about");
    expect((await bundle()).pages.map((page) => page.id)).toContain(about);

    await database.as(site.ownerId, (tx) => tx.query("select public.unpublish_page($1)", [about]));
    const [row] = await database.admin<{ status: string; published_revision_id: string | null }>(
      "select status, published_revision_id from public.pages where id = $1",
      [about],
    );

    expect(row).toEqual({ status: "concept", published_revision_id: null });
    expect((await bundle()).pages.map((page) => page.id)).not.toContain(about);
  });

  it("needs the publish capability", async () => {
    const editorId = await addMember(database, site.siteId, "editor");
    const about = await addPage(database, site.languageId, site.homepageId, "about");

    await publishPage(database, site.ownerId, about, "about");
    await expectDenied(() =>
      database.as(editorId, (tx) => tx.query("select public.unpublish_page($1)", [about])),
    );
  });

  it("refuses to unpublish the homepage", async () => {
    await expect(
      database.as(site.ownerId, (tx) =>
        tx.query("select public.unpublish_page($1)", [site.homepageId]),
      ),
    ).rejects.toThrow("homepage");
  });
});

describe("2.1 unpublishing records", () => {
  it("removes a record from delivery when it is set back to concept", async () => {
    const type = await publishedRecordType();
    const [record] = await database.as(
      site.ownerId,
      async (tx) =>
        (
          await tx.query<{ id: string }>(
            `insert into public.content_records (content_type_id, site_language_id, status, values)
           values ($1, $2, 'published', '{}') returning id`,
            [type.id, site.languageId],
          )
        ).rows,
    );
    const recordIds = async () =>
      (await bundle()).contentTypes
        .find((item) => item.slug === type.slug)
        ?.records.map((item) => item.id) ?? [];

    expect(await recordIds()).toContain(record?.id);

    await database.as(site.ownerId, (tx) =>
      tx.query("update public.content_records set status = 'concept' where id = $1", [record?.id]),
    );
    const [row] = await database.admin<{ published_revision_id: string | null }>(
      "select published_revision_id from public.content_records where id = $1",
      [record?.id],
    );

    expect(row?.published_revision_id).toBeNull();
    expect(await recordIds()).not.toContain(record?.id);
  });
});

describe("2.1 delivery filters on status", () => {
  it("does not deliver a page whose status is concept even if it has a published revision", async () => {
    const about = await addPage(database, site.languageId, site.homepageId, "about");

    await publishPage(database, site.ownerId, about, "about");
    await database.admin("update public.pages set status = 'concept' where id = $1", [about]);

    expect((await bundle()).pages.map((page) => page.id)).not.toContain(about);
  });
});
