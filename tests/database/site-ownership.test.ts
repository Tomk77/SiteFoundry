// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addMember, createOwnerSite, type SiteFixture } from "./fixtures";
import { createMigratedDatabase, expectDenied, type TestDatabase } from "./harness";

let database: TestDatabase;
let site: SiteFixture;
let adminId: string;

beforeEach(async () => {
  database = await createMigratedDatabase();
  site = await createOwnerSite(database);
  adminId = await addMember(database, site.siteId, "admin");
}, 120_000);

afterEach(() => database.close());

async function ownerOf(siteId: string) {
  const [row] = await database.admin<{ owner_id: string }>(
    "select owner_id from public.sites where id = $1",
    [siteId],
  );

  return row?.owner_id;
}

describe("1.1 site ownership", () => {
  it("does not let an administrator take ownership by updating sites.owner_id", async () => {
    await expectDenied(() =>
      database.as(adminId, (tx) =>
        tx.query("update public.sites set owner_id = $1 where id = $2", [adminId, site.siteId]),
      ),
    );
    expect(await ownerOf(site.siteId)).toBe(site.ownerId);
  });

  it("still lets an administrator edit the general site settings", async () => {
    await database.as(adminId, (tx) =>
      tx.query(
        `update public.sites
         set name = 'Renamed', slug = 'renamed-site', timezone = 'UTC', preview_url = '', icon_url = null
         where id = $1`,
        [site.siteId],
      ),
    );
    const [row] = await database.admin<{ name: string }>(
      "select name from public.sites where id = $1",
      [site.siteId],
    );

    expect(row?.name).toBe("Renamed");
  });

  it("keeps the owner membership and sites.owner_id in step", async () => {
    await expectDenied(() =>
      database.admin("update public.site_members set role = 'owner' where user_id = $1", [adminId]),
    );
    await expectDenied(() =>
      database.admin("update public.sites set owner_id = $1 where id = $2", [adminId, site.siteId]),
    );
  });

  it("still transfers ownership through transfer_site_ownership", async () => {
    await database.as(site.ownerId, (tx) =>
      tx.query("select public.transfer_site_ownership($1, $2)", [site.siteId, adminId]),
    );
    const roles = await database.admin<{ user_id: string; role: string }>(
      "select user_id, role from public.site_members where site_id = $1 order by role",
      [site.siteId],
    );

    expect(await ownerOf(site.siteId)).toBe(adminId);
    expect(roles).toEqual(
      expect.arrayContaining([
        { user_id: site.ownerId, role: "admin" },
        { user_id: adminId, role: "owner" },
      ]),
    );
  });
});

describe("settings flows after hardening", () => {
  it("lets an administrator add a language, which seeds its structured content", async () => {
    await database.as(adminId, (tx) =>
      tx.query(
        `insert into public.site_languages (site_id, code, name, url_prefix, position)
         values ($1, 'de', 'German', 'de', 2)`,
        [site.siteId],
      ),
    );
    const [row] = await database.admin<{ count: number }>(
      `select count(*)::int as count from public.content_types type
       join public.site_languages language on language.id = type.site_language_id
       where language.site_id = $1 and language.code = 'de'`,
      [site.siteId],
    );

    expect(row?.count).toBeGreaterThan(0);
  });
});

describe("site deletion after hardening", () => {
  it("lets the owner delete the site, and not an administrator", async () => {
    await database.as(adminId, (tx) =>
      tx.query("delete from public.sites where id = $1", [site.siteId]),
    );
    expect(await ownerOf(site.siteId)).toBe(site.ownerId);

    await database.as(site.ownerId, (tx) =>
      tx.query("delete from public.sites where id = $1", [site.siteId]),
    );
    expect(await ownerOf(site.siteId)).toBeUndefined();
  });
});

describe("1.4 memberships", () => {
  it("does not let an administrator add an arbitrary account as a member", async () => {
    const strangerId = await database.createUser("stranger@example.test");

    await expectDenied(() =>
      database.as(adminId, (tx) =>
        tx.query(
          "insert into public.site_members (site_id, user_id, role) values ($1, $2, 'viewer')",
          [site.siteId, strangerId],
        ),
      ),
    );
  });

  it("does not let an administrator rewrite a membership row directly", async () => {
    const editorId = await addMember(database, site.siteId, "editor");
    const strangerId = await database.createUser("stranger-two@example.test");

    await expectDenied(() =>
      database.as(adminId, (tx) =>
        tx.query(
          "update public.site_members set user_id = $1 where user_id = $2 and site_id = $3",
          [strangerId, editorId, site.siteId],
        ),
      ),
    );
  });

  it("still changes member access through update_site_member_access", async () => {
    const editorId = await addMember(database, site.siteId, "editor");

    await database.as(adminId, (tx) =>
      tx.query(
        "select public.update_site_member_access($1, $2, 'viewer', 'full', '{}', '{}', '{}')",
        [site.siteId, editorId],
      ),
    );
    const [row] = await database.admin<{ role: string }>(
      "select role from public.site_members where user_id = $1 and site_id = $2",
      [editorId, site.siteId],
    );

    expect(row?.role).toBe("viewer");
  });
});

describe("1.8 site creation", () => {
  it("does not let an authenticated user insert an orphan site", async () => {
    const userId = await database.createUser("creator@example.test");

    await expectDenied(() =>
      database.as(userId, (tx) =>
        tx.query(
          "insert into public.sites (name, slug, owner_id) values ('Orphan', 'orphan', $1)",
          [userId],
        ),
      ),
    );
  });
});
