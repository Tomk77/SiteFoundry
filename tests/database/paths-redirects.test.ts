// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deliver, publishPage } from "./delivery";
import { addPage, createOwnerSite, type SiteFixture } from "./fixtures";
import { createMigratedDatabase, expectDenied, type TestDatabase } from "./harness";

let database: TestDatabase;
let site: SiteFixture;

beforeEach(async () => {
  database = await createMigratedDatabase();
  site = await createOwnerSite(database);
}, 120_000);

afterEach(() => database.close());

async function paths() {
  const bundle = await deliver(database, site.ownerId, site.siteId, site.siteSlug);

  return Object.fromEntries(bundle.pages.map((page) => [page.id, page.path]));
}

async function redirects() {
  return database.admin<{ source_path: string; destination_path: string }>(
    `select source_path, destination_path from public.redirects
     where site_language_id = $1 order by source_path`,
    [site.languageId],
  );
}

function move(pageId: string, targetId: string) {
  return database.as(site.ownerId, (tx) =>
    tx.query("select public.move_page($1, $2, 'inside', true)", [pageId, targetId]),
  );
}

async function saveSlug(pageId: string, slug: string, publish: boolean) {
  await database.as(site.ownerId, (tx) =>
    tx.query(
      `select public.save_page_revision(
         $1, (select concept_revision_id from public.pages where id = $1),
         'Title', $2, '[]'::jsonb, '', '', null, null, 'ready', $3)`,
      [pageId, slug, publish],
    ),
  );
}

describe("2.2 delivered paths follow the live tree", () => {
  it("delivers a moved page and its descendants at their new paths", async () => {
    const news = await addPage(database, site.languageId, site.homepageId, "news");
    const about = await addPage(database, site.languageId, site.homepageId, "about");
    const team = await addPage(database, site.languageId, about, "team");

    await publishPage(database, site.ownerId, news, "news");
    await publishPage(database, site.ownerId, about, "about");
    await publishPage(database, site.ownerId, team, "team");
    await move(about, news);

    expect(await paths()).toMatchObject({ [about]: "/news/about", [team]: "/news/about/team" });
    expect(await redirects()).toEqual([
      { source_path: "/about", destination_path: "/news/about" },
      { source_path: "/about/team", destination_path: "/news/about/team" },
    ]);
  });

  it("keeps the published path until a slug change is published, then redirects", async () => {
    const about = await addPage(database, site.languageId, site.homepageId, "about");
    const team = await addPage(database, site.languageId, about, "team");

    await publishPage(database, site.ownerId, about, "about");
    await publishPage(database, site.ownerId, team, "team");
    await saveSlug(about, "company", false);

    expect(await paths()).toMatchObject({ [about]: "/about", [team]: "/about/team" });
    expect(await redirects()).toEqual([]);

    await saveSlug(about, "company", true);

    expect(await paths()).toMatchObject({ [about]: "/company", [team]: "/company/team" });
    expect(await redirects()).toEqual([
      { source_path: "/about", destination_path: "/company" },
      { source_path: "/about/team", destination_path: "/company/team" },
    ]);
  });
});

describe("published URLs stay unique (review of #4)", () => {
  it("does not let another page take a slug that is still published", async () => {
    const about = await addPage(database, site.languageId, site.homepageId, "about");

    await publishPage(database, site.ownerId, about, "about");
    await saveSlug(about, "company", false);

    await expectDenied(() => addPage(database, site.languageId, site.homepageId, "about"));
  });

  it("does not let a page publish or move onto a sibling's published slug", async () => {
    const about = await addPage(database, site.languageId, site.homepageId, "about");
    const team = await addPage(database, site.languageId, site.homepageId, "team");
    const news = await addPage(database, site.languageId, site.homepageId, "news");
    const nested = await addPage(database, site.languageId, news, "about");

    await publishPage(database, site.ownerId, about, "about");
    await saveSlug(about, "company", false);

    await expectDenied(() => saveSlug(team, "about", true));
    await expectDenied(() => move(nested, site.homepageId));
  });

  it("frees the old slug once the new one is published", async () => {
    const about = await addPage(database, site.languageId, site.homepageId, "about");

    await publishPage(database, site.ownerId, about, "about");
    await saveSlug(about, "company", true);

    await addPage(database, site.languageId, site.homepageId, "about");
  });
});

describe("2.3 redirects stay consistent across repeated moves", () => {
  it("moves a page away and back three times without errors or loops", async () => {
    const news = await addPage(database, site.languageId, site.homepageId, "news");
    const about = await addPage(database, site.languageId, site.homepageId, "about");

    await publishPage(database, site.ownerId, about, "about");
    await move(about, news);
    await move(about, site.homepageId);
    await move(about, news);

    expect(await redirects()).toEqual([{ source_path: "/about", destination_path: "/news/about" }]);
  });

  it("points older redirects at the newest path", async () => {
    const news = await addPage(database, site.languageId, site.homepageId, "news");
    const archive = await addPage(database, site.languageId, site.homepageId, "archive");
    const about = await addPage(database, site.languageId, site.homepageId, "about");

    await publishPage(database, site.ownerId, about, "about");
    await move(about, news);
    await move(about, archive);

    expect(await redirects()).toEqual([
      { source_path: "/about", destination_path: "/archive/about" },
      { source_path: "/news/about", destination_path: "/archive/about" },
    ]);
  });
});
