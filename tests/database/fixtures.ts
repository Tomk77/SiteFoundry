import type { TestDatabase } from "./harness";

export type MemberRole = "admin" | "publisher" | "editor" | "viewer";

export type SiteFixture = {
  ownerId: string;
  siteId: string;
  siteSlug: string;
  languageId: string;
  homepageId: string;
};

let counter = 0;

function uniqueEmail(label: string) {
  counter += 1;

  return `${label}-${counter}@example.test`;
}

/** Signs up a new account. The signup trigger gives it a site, an English tree and a homepage. */
export async function createOwnerSite(database: TestDatabase): Promise<SiteFixture> {
  const ownerId = await database.createUser(uniqueEmail("owner"));
  const [site] = await database.admin<{
    site_id: string;
    slug: string;
    language_id: string;
    homepage_id: string;
  }>(
    `select site.id as site_id, site.slug, language.id as language_id, page.id as homepage_id
     from public.sites site
     join public.site_languages language on language.site_id = site.id and language.code = 'en'
     join public.pages page on page.site_language_id = language.id and page.is_homepage
     where site.owner_id = $1`,
    [ownerId],
  );

  if (!site) throw new Error("Signup did not create a site");

  return {
    ownerId,
    siteId: site.site_id,
    siteSlug: site.slug,
    languageId: site.language_id,
    homepageId: site.homepage_id,
  };
}

export async function addMember(
  database: TestDatabase,
  siteId: string,
  role: MemberRole,
  access: {
    scope?: "full" | "languages" | "branches";
    languageIds?: string[];
    branchIds?: string[];
    sections?: string[];
  } = {},
): Promise<string> {
  const userId = await database.createUser(uniqueEmail(role));

  await database.admin(
    `insert into public.site_members
       (site_id, user_id, role, access_scope, language_ids, branch_ids, sections)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      siteId,
      userId,
      role,
      access.scope ?? "full",
      access.languageIds ?? [],
      access.branchIds ?? [],
      access.sections ?? [
        "pages",
        "media",
        "redirects",
        "navigation",
        "footer",
        "structured",
        "templates",
      ],
    ],
  );

  return userId;
}

/** Adds a language with its own homepage. */
export async function addLanguage(
  database: TestDatabase,
  siteId: string,
  code: string,
): Promise<{ languageId: string; homepageId: string }> {
  const [language] = await database.admin<{ id: string }>(
    `insert into public.site_languages (site_id, code, name, is_default, position, url_prefix)
     values ($1, $2, upper($2), false, 1, $2) returning id`,
    [siteId, code],
  );

  if (!language) throw new Error("Language insert failed");
  const [homepage] = await database.admin<{ id: string }>(
    `insert into public.pages (site_language_id, title, slug, template_name, status, is_homepage, position)
     values ($1, 'Home', '', 'Landing page', 'concept', true, 0) returning id`,
    [language.id],
  );

  if (!homepage) throw new Error("Homepage insert failed");

  return { languageId: language.id, homepageId: homepage.id };
}

export async function addPage(
  database: TestDatabase,
  languageId: string,
  parentId: string,
  slug: string,
): Promise<string> {
  const [page] = await database.admin<{ id: string }>(
    `insert into public.pages (site_language_id, parent_id, title, slug, template_name, status, position)
     values ($1, $2, initcap($3), $3, 'Content page', 'concept', 0) returning id`,
    [languageId, parentId, slug],
  );

  if (!page) throw new Error("Page insert failed");

  return page.id;
}
