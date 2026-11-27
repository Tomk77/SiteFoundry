// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addMember, addPage, createOwnerSite, type SiteFixture } from "./fixtures";
import { createMigratedDatabase, expectDenied, type TestDatabase } from "./harness";

let database: TestDatabase;
let site: SiteFixture;

beforeEach(async () => {
  database = await createMigratedDatabase();
  site = await createOwnerSite(database);
}, 120_000);

afterEach(() => database.close());

describe("2.5 rename_page", () => {
  it("renames through a new concept revision", async () => {
    const about = await addPage(database, site.languageId, site.homepageId, "about");

    await database.as(site.ownerId, (tx) =>
      tx.query("select public.rename_page($1, '  About us  ')", [about]),
    );
    const [row] = await database.admin<{ title: string; version: number; snapshot_title: string }>(
      `select page.title, revision.version, revision.snapshot ->> 'title' as snapshot_title
       from public.pages page
       join public.page_revisions revision on revision.id = page.concept_revision_id
       where page.id = $1`,
      [about],
    );

    expect(row).toEqual({ title: "About us", version: 1, snapshot_title: "About us" });
  });

  it("rejects an empty title and members without edit access", async () => {
    const viewerId = await addMember(database, site.siteId, "viewer");
    const about = await addPage(database, site.languageId, site.homepageId, "about");

    await expectDenied(() =>
      database.as(site.ownerId, (tx) => tx.query("select public.rename_page($1, '  ')", [about])),
    );
    await expectDenied(() =>
      database.as(viewerId, (tx) => tx.query("select public.rename_page($1, 'X')", [about])),
    );
  });

  it("no longer accepts direct title updates", async () => {
    const about = await addPage(database, site.languageId, site.homepageId, "about");

    await expectDenied(() =>
      database.as(site.ownerId, (tx) =>
        tx.query("update public.pages set title = 'Direct' where id = $1", [about]),
      ),
    );
  });
});

describe("2.5 delete_page", () => {
  it("deletes a leaf page", async () => {
    const about = await addPage(database, site.languageId, site.homepageId, "about");

    await database.as(site.ownerId, (tx) => tx.query("select public.delete_page($1)", [about]));

    expect(await database.admin("select id from public.pages where id = $1", [about])).toEqual([]);
  });

  it("refuses the homepage and pages with children", async () => {
    const about = await addPage(database, site.languageId, site.homepageId, "about");

    await addPage(database, site.languageId, about, "team");
    expect(
      await expectDenied(() =>
        database.as(site.ownerId, (tx) => tx.query("select public.delete_page($1)", [about])),
      ),
    ).toContain("child pages");
    expect(
      await expectDenied(() =>
        database.as(site.ownerId, (tx) =>
          tx.query("select public.delete_page($1)", [site.homepageId]),
        ),
      ),
    ).toContain("homepage");
  });

  it("no longer accepts direct deletes", async () => {
    const about = await addPage(database, site.languageId, site.homepageId, "about");

    await expectDenied(() =>
      database.as(site.ownerId, (tx) =>
        tx.query("delete from public.pages where id = $1", [about]),
      ),
    );
  });
});

describe("2.5 publish_navigation_menu", () => {
  it("publishes draft items with the server clock", async () => {
    const [menu] = await database.admin<{ id: string }>(
      "select id from public.navigation_menus where site_language_id = $1 and location = 'header'",
      [site.languageId],
    );
    const items = JSON.stringify([{ label: "Blog", type: "page", path: "/blog" }]);

    await database.as(site.ownerId, (tx) =>
      tx.query("select public.publish_navigation_menu($1, $2::jsonb)", [menu?.id, items]),
    );
    const [row] = await database.admin<{ same: boolean; recent: boolean }>(
      `select draft_items = published_items and published_items = $2::jsonb as same,
              published_at > now() - interval '1 minute' as recent
       from public.navigation_menus where id = $1`,
      [menu?.id, items],
    );

    expect(row).toEqual({ same: true, recent: true });
  });
});
