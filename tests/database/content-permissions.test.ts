// @vitest-environment node
import type { Transaction } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addLanguage, addMember, addPage, createOwnerSite, type SiteFixture } from "./fixtures";
import { createMigratedDatabase, expectDenied, type TestDatabase } from "./harness";

let database: TestDatabase;
let site: SiteFixture;

beforeEach(async () => {
  database = await createMigratedDatabase();
  site = await createOwnerSite(database);
}, 120_000);

afterEach(() => database.close());

function savePage(tx: Transaction, pageId: string, slug: string, publish: boolean) {
  return tx.query(
    `select public.save_page_revision(
       $1, (select concept_revision_id from public.pages where id = $1),
       'Title', $2, '[]'::jsonb, '', '', null, null, 'ready', $3)`,
    [pageId, slug, publish],
  );
}

function insertPage(tx: Transaction, languageId: string, parentId: string, slug: string) {
  return tx.query(
    `insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, position)
     values ($1, $2, 'New', $3, 'Content page', 'concept', 0)`,
    [languageId, parentId, slug],
  );
}

async function contentTypeId(languageId: string) {
  const [row] = await database.admin<{ id: string }>(
    "select id from public.content_types where site_language_id = $1 order by position limit 1",
    [languageId],
  );

  if (!row) throw new Error("No seeded content type");

  return row.id;
}

describe("1.3 publisher and editor roles", () => {
  it("lets a publisher edit and publish pages", async () => {
    const publisherId = await addMember(database, site.siteId, "publisher");
    const pageId = await addPage(database, site.languageId, site.homepageId, "about");

    await database.as(publisherId, async (tx) => {
      await insertPage(tx, site.languageId, site.homepageId, "contact");
      await savePage(tx, pageId, "about", false);
      await tx.query("select public.publish_page($1)", [pageId]);
    });
    const [row] = await database.admin<{ status: string }>(
      "select status from public.pages where id = $1",
      [pageId],
    );

    expect(row?.status).toBe("published");
  });

  it("lets an editor save a concept but not publish it", async () => {
    const editorId = await addMember(database, site.siteId, "editor");
    const pageId = await addPage(database, site.languageId, site.homepageId, "about");

    await database.as(editorId, (tx) => savePage(tx, pageId, "about", false));
    await expectDenied(() =>
      database.as(editorId, (tx) => tx.query("select public.publish_page($1)", [pageId])),
    );
    await expectDenied(() => database.as(editorId, (tx) => savePage(tx, pageId, "about", true)));
  });

  it("does not let an editor publish a structured content record", async () => {
    const editorId = await addMember(database, site.siteId, "editor");
    const typeId = await contentTypeId(site.languageId);

    await database.as(editorId, (tx) =>
      tx.query(
        `insert into public.content_records (content_type_id, site_language_id, status, values)
         values ($1, $2, 'concept', '{}')`,
        [typeId, site.languageId],
      ),
    );
    await expectDenied(() =>
      database.as(editorId, (tx) =>
        tx.query(
          `insert into public.content_records (content_type_id, site_language_id, status, values)
           values ($1, $2, 'published', '{}')`,
          [typeId, site.languageId],
        ),
      ),
    );
    await expectDenied(() =>
      database.as(editorId, async (tx) => {
        const result = await tx.query(
          "update public.content_records set status = 'published' where site_language_id = $1 and status = 'concept' returning id",
          [site.languageId],
        );

        if (result.rows.length === 0) throw new Error("no rows updated");
      }),
    );
  });
});

describe("menu publishing", () => {
  async function headerMenu() {
    const [menu] = await database.admin<{ id: string }>(
      `insert into public.navigation_menus (site_language_id, location)
       values ($1, 'header')
       on conflict (site_language_id, location) do update set location = excluded.location
       returning id`,
      [site.languageId],
    );

    if (!menu) throw new Error("No menu");

    return menu.id;
  }

  const items = JSON.stringify([{ label: "Blog", type: "page", path: "/blog" }]);

  it("lets an editor save a draft menu but not publish it", async () => {
    const editorId = await addMember(database, site.siteId, "editor");
    const menuId = await headerMenu();

    await database.as(editorId, (tx) =>
      tx.query("update public.navigation_menus set draft_items = $1 where id = $2", [
        items,
        menuId,
      ]),
    );
    await expectDenied(() =>
      database.as(editorId, (tx) =>
        tx.query(
          "update public.navigation_menus set published_items = $1, published_at = now() where id = $2",
          [items, menuId],
        ),
      ),
    );
    await expectDenied(() =>
      database.as(editorId, (tx) =>
        tx.query(
          `insert into public.navigation_menus (site_language_id, location, published_items)
           values ($1, 'footer', $2)`,
          [site.languageId, items],
        ),
      ),
    );
  });

  it("lets a publisher publish a menu", async () => {
    const publisherId = await addMember(database, site.siteId, "publisher");
    const menuId = await headerMenu();

    await database.as(publisherId, (tx) =>
      tx.query(
        "update public.navigation_menus set published_items = $1, published_at = now() where id = $2",
        [items, menuId],
      ),
    );
  });
});

describe("1.2 access scope", () => {
  it("limits a language-scoped editor to their languages", async () => {
    const dutch = await addLanguage(database, site.siteId, "nl");
    const editorId = await addMember(database, site.siteId, "editor", {
      scope: "languages",
      languageIds: [dutch.languageId],
    });

    await database.as(editorId, (tx) => insertPage(tx, dutch.languageId, dutch.homepageId, "over"));
    await expectDenied(() =>
      database.as(editorId, (tx) => insertPage(tx, site.languageId, site.homepageId, "about")),
    );
  });

  it("hides out-of-scope languages from a language-scoped viewer", async () => {
    const dutch = await addLanguage(database, site.siteId, "nl");
    const viewerId = await addMember(database, site.siteId, "viewer", {
      scope: "languages",
      languageIds: [dutch.languageId],
    });
    const visible = await database.as(viewerId, (tx) =>
      tx.query<{ site_language_id: string }>(
        `select distinct page.site_language_id from public.pages page
         join public.site_languages language on language.id = page.site_language_id
         where language.site_id = $1`,
        [site.siteId],
      ),
    );

    expect(visible.rows).toEqual([{ site_language_id: dutch.languageId }]);
  });

  it("limits a branch-scoped editor to the branch and its descendants", async () => {
    const blog = await addPage(database, site.languageId, site.homepageId, "blog");
    const post = await addPage(database, site.languageId, blog, "first-post");
    const about = await addPage(database, site.languageId, site.homepageId, "about");
    const editorId = await addMember(database, site.siteId, "editor", {
      scope: "branches",
      branchIds: [blog],
    });

    await database.as(editorId, async (tx) => {
      await tx.query("select public.rename_page($1, 'Renamed')", [post]);
      await insertPage(tx, site.languageId, blog, "second-post");
      await savePage(tx, post, "first-post", false);
    });
    await expectDenied(() =>
      database.as(editorId, (tx) => tx.query("select public.rename_page($1, 'Hijacked')", [about])),
    );
    await expectDenied(() =>
      database.as(editorId, (tx) => insertPage(tx, site.languageId, about, "team")),
    );
    await expectDenied(() => database.as(editorId, (tx) => savePage(tx, about, "about", false)));
  });

  it("does not give a branch-scoped editor language-wide resources", async () => {
    const blog = await addPage(database, site.languageId, site.homepageId, "blog");
    const editorId = await addMember(database, site.siteId, "editor", {
      scope: "branches",
      branchIds: [blog],
    });

    await expectDenied(() =>
      database.as(editorId, (tx) =>
        tx.query(
          `insert into public.redirects (site_language_id, source_path, destination_path)
           values ($1, '/old', '/blog')`,
          [site.languageId],
        ),
      ),
    );
  });
});

describe("1.2 section access", () => {
  it("limits an editor to the product sections they were given", async () => {
    const editorId = await addMember(database, site.siteId, "editor", { sections: ["pages"] });
    const typeId = await contentTypeId(site.languageId);

    await database.as(editorId, (tx) => insertPage(tx, site.languageId, site.homepageId, "about"));
    await expectDenied(() =>
      database.as(editorId, (tx) =>
        tx.query(
          `insert into public.content_records (content_type_id, site_language_id, status, values)
           values ($1, $2, 'concept', '{}')`,
          [typeId, site.languageId],
        ),
      ),
    );
    await expectDenied(() =>
      database.as(editorId, (tx) =>
        tx.query(
          `insert into public.redirects (site_language_id, source_path, destination_path)
           values ($1, '/old', '/about')`,
          [site.languageId],
        ),
      ),
    );
    await expectDenied(() =>
      database.as(editorId, (tx) =>
        tx.query(
          `select public.save_page_template($1, null, 'landing-two', 'Landing two', '', 'file',
             'draft', false, '{}'::jsonb, '/', '[]'::jsonb)`,
          [site.languageId],
        ),
      ),
    );
    await expectDenied(() =>
      database.as(editorId, (tx) =>
        tx.query(
          `insert into public.navigation_menus (site_language_id, location, draft_items, published_items)
           values ($1, 'header', '[]', '[]')
           on conflict (site_language_id, location) do update set draft_items = '[]'`,
          [site.languageId],
        ),
      ),
    );
  });

  it("does not restrict owners and administrators by sections", async () => {
    const adminId = await addMember(database, site.siteId, "admin", { sections: [] });

    await database.as(adminId, (tx) =>
      tx.query(
        `insert into public.redirects (site_language_id, source_path, destination_path)
         values ($1, '/old', '/new')`,
        [site.languageId],
      ),
    );
  });
});
