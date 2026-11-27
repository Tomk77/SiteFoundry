// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deliver, publishPage } from "./delivery";
import { addLanguage, addPage, createOwnerSite, type SiteFixture } from "./fixtures";
import { createMigratedDatabase, type TestDatabase } from "./harness";

let database: TestDatabase;
let site: SiteFixture;

beforeEach(async () => {
  database = await createMigratedDatabase();
  site = await createOwnerSite(database);
}, 120_000);

afterEach(() => database.close());

type DeliveredMenu = { location: string; items: { target: string; children: unknown[] }[] };

describe("2.6 navigation menus", () => {
  it("exists for every language without being created on read", async () => {
    const dutch = await addLanguage(database, site.siteId, "nl");
    const menus = await database.admin<{ location: string }>(
      "select location from public.navigation_menus where site_language_id = $1 order by location",
      [dutch.languageId],
    );

    expect(menus).toEqual([{ location: "footer" }, { location: "header" }]);
  });

  it("delivers page items at the page's current path", async () => {
    const news = await addPage(database, site.languageId, site.homepageId, "news");
    const about = await addPage(database, site.languageId, site.homepageId, "about");

    await publishPage(database, site.ownerId, news, "news");
    await publishPage(database, site.ownerId, about, "about");
    const items = [
      {
        id: "a",
        kind: "link",
        label: "About",
        target: "/about",
        targetType: "page",
        pageId: about,
        newTab: false,
        children: [],
      },
      {
        id: "b",
        kind: "link",
        label: "Legacy",
        target: "/legacy",
        targetType: "page",
        newTab: false,
        children: [],
      },
      {
        id: "c",
        kind: "link",
        label: "Docs",
        target: "https://example.test",
        targetType: "url",
        newTab: true,
        children: [],
      },
    ];

    await database.as(site.ownerId, (tx) =>
      tx.query(
        `select public.publish_navigation_menu(
           (select id from public.navigation_menus where site_language_id = $1 and location = 'header'),
           $2::jsonb)`,
        [site.languageId, JSON.stringify(items)],
      ),
    );
    await database.as(site.ownerId, (tx) =>
      tx.query("select public.move_page($1, $2, 'inside', true)", [about, news]),
    );
    const bundle = (await deliver(
      database,
      site.ownerId,
      site.siteId,
      site.siteSlug,
    )) as unknown as {
      navigation: DeliveredMenu[];
    };
    const header = bundle.navigation.find((menu) => menu.location === "header");

    expect(header?.items.map((item) => item.target)).toEqual([
      "/news/about",
      "/legacy",
      "https://example.test",
    ]);
  });
});
