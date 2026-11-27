// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addMember, addPage, createOwnerSite, type SiteFixture } from "./fixtures";
import { createMigratedDatabase, expectDenied, type TestDatabase } from "./harness";

let database: TestDatabase;
let site: SiteFixture;
let editorId: string;

beforeEach(async () => {
  database = await createMigratedDatabase();
  site = await createOwnerSite(database);
  editorId = await addMember(database, site.siteId, "editor");
}, 120_000);

afterEach(() => database.close());

async function publishedPage(slug: string) {
  const pageId = await addPage(database, site.languageId, site.homepageId, slug);

  await database.as(site.ownerId, (tx) =>
    tx.query(
      `select public.save_page_revision($1, null, 'Title', $2, '[]'::jsonb, '', '', null, null, 'ready', true)`,
      [pageId, slug],
    ),
  );

  return pageId;
}

async function revisionOf(pageId: string) {
  const [row] = await database.admin<{ published_revision_id: string }>(
    "select published_revision_id from public.pages where id = $1",
    [pageId],
  );

  return row?.published_revision_id;
}

async function functionSource(signature: string) {
  const [row] = await database.admin<{ source: string }>(
    "select pg_get_functiondef(to_regprocedure($1)) as source",
    [signature],
  );

  return row?.source ?? "";
}

describe("1.6 function-managed page and record columns", () => {
  it("does not let a page point at another page's published revision", async () => {
    const about = await publishedPage("about");
    const contactRevision = await revisionOf(await publishedPage("contact"));

    await expectDenied(() =>
      database.admin("update public.pages set published_revision_id = $1 where id = $2", [
        contactRevision,
        about,
      ]),
    );
  });

  it("does not let a record point at another record's published revision", async () => {
    const [type] = await database.admin<{ id: string }>(
      "select id from public.content_types where site_language_id = $1 limit 1",
      [site.languageId],
    );
    const records = await database.admin<{ id: string; published_revision_id: string }>(
      `insert into public.content_records (content_type_id, site_language_id, status, values)
       values ($1, $2, 'published', '{}'), ($1, $2, 'published', '{}')
       returning id`,
      [type?.id, site.languageId],
    );
    const [first, second] = await database.admin<{ id: string; published_revision_id: string }>(
      "select id, published_revision_id from public.content_records where id = any($1)",
      [records.map((record) => record.id)],
    );

    await expectDenied(() =>
      database.admin("update public.content_records set published_revision_id = $1 where id = $2", [
        second?.published_revision_id,
        first?.id,
      ]),
    );
  });

  it("does not let a content member write function-managed page columns directly", async () => {
    const about = await publishedPage("about");
    const contact = await publishedPage("contact");

    for (const [assignment, params] of [
      ["published_revision_id = null", []],
      ["status = 'concept'", []],
      ["slug = 'renamed'", []],
      ["parent_id = $2", [contact]],
      ["concept_revision_id = null", []],
      ["is_homepage = true", []],
    ] as const) {
      await expectDenied(() =>
        database.as(editorId, (tx) =>
          tx.query(`update public.pages set ${assignment} where id = $1`, [about, ...params]),
        ),
      );
    }
  });

  it("does not let a content member insert a page that claims to be published", async () => {
    await expectDenied(() =>
      database.as(editorId, (tx) =>
        tx.query(
          `insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, position)
           values ($1, $2, 'Fake', 'fake', 'Content page', 'published', 0)`,
          [site.languageId, site.homepageId],
        ),
      ),
    );
  });

  it("still lets a content member rename a page", async () => {
    const about = await publishedPage("about");

    await database.as(editorId, (tx) =>
      tx.query("update public.pages set title = 'About us' where id = $1", [about]),
    );
  });

  it("does not let a content member write a record's published revision directly", async () => {
    const [type] = await database.admin<{ id: string }>(
      "select id from public.content_types where site_language_id = $1 limit 1",
      [site.languageId],
    );

    await expectDenied(() =>
      database.as(editorId, (tx) =>
        tx.query(
          `update public.content_records set published_revision_id = null
           where content_type_id = $1`,
          [type?.id],
        ),
      ),
    );
  });
});

describe("1.7 page tree cycles", () => {
  it("rejects a page that is its own parent", async () => {
    const about = await addPage(database, site.languageId, site.homepageId, "about");

    await expectDenied(() =>
      database.admin("update public.pages set parent_id = id where id = $1", [about]),
    );
  });

  it("serialises tree changes per language with an advisory lock", async () => {
    const blog = await addPage(database, site.languageId, site.homepageId, "blog");
    const about = await addPage(database, site.languageId, site.homepageId, "about");
    const locks = await database.as(site.ownerId, async (tx) => {
      await tx.query("select public.move_page($1, $2, 'inside', false)", [about, blog]);

      // PGlite is single-process and reports no pid, so count every advisory lock held here.
      return tx.query<{ count: number }>(
        "select count(*)::int as count from pg_locks where locktype = 'advisory' and granted",
      );
    });

    expect(locks.rows[0]?.count).toBeGreaterThan(0);
  });

  it("terminates path and descendant queries on a corrupted, cyclic tree", async () => {
    // PGlite ignores statement_timeout, so an unguarded recursive query would hang the run.
    expect(await functionSource("private.page_path(uuid)")).toMatch(/\bcycle\b/i);
    expect(await functionSource("public.validate_page_tree()")).toMatch(/\bcycle\b/i);

    const first = await addPage(database, site.languageId, site.homepageId, "first");
    const second = await addPage(database, site.languageId, first, "second");

    await database.db.exec("set session_replication_role = replica");
    await database.admin("update public.pages set parent_id = $1 where id = $2", [second, first]);
    await database.db.exec("set session_replication_role = origin");

    const [row] = await database.admin<{ path: string }>("select private.page_path($1) as path", [
      second,
    ]);

    expect(typeof row?.path).toBe("string");
  });
});

describe("move_page after hardening", () => {
  it("moves a published page and records a redirect", async () => {
    const blog = await addPage(database, site.languageId, site.homepageId, "blog");
    const about = await publishedPage("about");
    const [result] = await database.as(
      site.ownerId,
      async (tx) =>
        (
          await tx.query<{ moved: { redirectsCreated: number } }>(
            "select public.move_page($1, $2, 'inside', true) as moved",
            [about, blog],
          )
        ).rows,
    );
    const redirects = await database.admin<{ source_path: string; destination_path: string }>(
      "select source_path, destination_path from public.redirects where page_id = $1",
      [about],
    );

    expect(result?.moved.redirectsCreated).toBe(1);
    expect(redirects).toEqual([{ source_path: "/about", destination_path: "/blog/about" }]);
  });

  it("does not let a branch-scoped editor move a page into another branch", async () => {
    const blog = await addPage(database, site.languageId, site.homepageId, "blog");
    const news = await addPage(database, site.languageId, site.homepageId, "news");
    const post = await addPage(database, site.languageId, blog, "post");
    const scopedId = await addMember(database, site.siteId, "editor", {
      scope: "branches",
      branchIds: [blog],
    });

    await expectDenied(() =>
      database.as(scopedId, (tx) =>
        tx.query("select public.move_page($1, $2, 'inside', false)", [post, news]),
      ),
    );
  });

  it("keeps the unchecked function bodies out of reach of API roles", async () => {
    const pageId = await addPage(database, site.languageId, site.homepageId, "about");

    expect(
      await expectDenied(() =>
        database.as(editorId, (tx) =>
          tx.query("select private.publish_page_unchecked($1)", [pageId]),
        ),
      ),
    ).toContain("permission denied");
  });
});

describe("1.9 slug format", () => {
  it.each(["a/b", "../x", "Upper", "with space", "-leading", "trailing-"])(
    "rejects the page slug %j",
    async (slug) => {
      await expectDenied(() =>
        database.admin(
          `insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, position)
           values ($1, $2, 'Bad', $3, 'Content page', 'concept', 0)`,
          [site.languageId, site.homepageId, slug],
        ),
      );
    },
  );

  it("rejects a site slug with a path separator", async () => {
    await expectDenied(() =>
      database.as(site.ownerId, (tx) =>
        tx.query("update public.sites set slug = 'a/b' where id = $1", [site.siteId]),
      ),
    );
  });

  it("accepts ordinary slugs", async () => {
    await addPage(database, site.languageId, site.homepageId, "news-2026");
    await database.as(site.ownerId, (tx) =>
      tx.query("update public.sites set slug = 'northstar-site' where id = $1", [site.siteId]),
    );
  });
});

describe("1.10 legacy move_page", () => {
  it("removes the three-argument move_page that skips redirects", async () => {
    const [row] = await database.admin<{ exists: boolean }>(
      "select to_regprocedure('public.move_page(uuid, uuid, text)') is not null as exists",
    );

    expect(row?.exists).toBe(false);
  });
});
