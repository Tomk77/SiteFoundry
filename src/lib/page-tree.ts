import { getSupabaseBrowserClient, getSupabaseConfigError } from "./supabase";
import { cloneTemplateComponentsForPage, type PageTemplateDefinition } from "./page-templates";

export type PageStatus = "Published" | "Concept";
export interface WorkspaceOption {
  siteId: string;
  siteName: string;
  languageId: string;
  languageName: string;
  languageCode: string;
}

export interface PageNode {
  id: string;
  parentId: string | null;
  title: string;
  slug: string;
  template: string;
  templateId: string | null;
  templateKey: string | null;
  status: PageStatus;
  validation: "Ready" | "Needs attention";
  updatedAt: string;
  isHomepage: boolean;
  preferredChildTemplate: string | null;
  children: PageNode[];
}

export interface PageTreeWorkspace {
  site: { id: string; name: string; slug: string };
  language: { id: string; code: string; name: string };
  workspaces: WorkspaceOption[];
  pages: PageNode[];
  pageCount: number;
  lastUpdatedAt: string;
}

interface CompactPage {
  id: string;
  parent_id: string | null;
  title: string;
  slug: string;
  template_name: string;
  created_from_template_id: string | null;
  created_from_template_key: string | null;
  status: string;
  validation_status: string;
  position: number;
  is_homepage: boolean;
  preferred_child_template: string | null;
  updated_at: string;
}

function buildPath(parentPath: string, slug: string, isHomepage: boolean) {
  if (isHomepage) return "/";

  return `${parentPath === "/" ? "" : parentPath}/${slug}`;
}

function buildTree(rows: CompactPage[]) {
  const childrenByParent = new Map<string | null, CompactPage[]>();
  for (const row of rows)
    childrenByParent.set(row.parent_id, [...(childrenByParent.get(row.parent_id) ?? []), row]);
  for (const siblings of childrenByParent.values())
    siblings.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
  const visit = (row: CompactPage, parentPath: string, ancestors: Set<string>): PageNode => {
    if (ancestors.has(row.id)) throw new Error("The page tree contains a cycle.");
    const path = buildPath(parentPath, row.slug, row.is_homepage);

    return {
      id: row.id,
      parentId: row.parent_id,
      title: row.title,
      slug: path,
      template: row.template_name,
      templateId: row.created_from_template_id,
      templateKey: row.created_from_template_key,
      status: row.status === "published" ? "Published" : "Concept",
      validation: row.validation_status === "needs_attention" ? "Needs attention" : "Ready",
      updatedAt: row.updated_at,
      isHomepage: row.is_homepage,
      preferredChildTemplate: row.preferred_child_template,
      children: (childrenByParent.get(row.id) ?? []).map((child) =>
        visit(child, path, new Set(ancestors).add(row.id)),
      ),
    };
  };

  return (childrenByParent.get(null) ?? []).map((row) => visit(row, "/", new Set()));
}

export async function loadPageTreeWorkspace(
  selection: { siteId?: string; languageId?: string } = {},
): Promise<PageTreeWorkspace | null> {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const { data: sites, error: sitesError } = await client
    .from("sites")
    .select("id, name, slug, updated_at")
    .order("created_at");
  if (sitesError) throw sitesError;
  if (!sites?.length) return null;
  const site = sites.find((item) => item.id === selection.siteId) ?? sites[0];
  if (!site) return null;
  const { data: allLanguages, error: languageError } = await client
    .from("site_languages")
    .select("id, site_id, code, name, is_default, position, updated_at")
    .in(
      "site_id",
      sites.map((item) => item.id),
    )
    .order("position");
  if (languageError) throw languageError;
  const siteLanguages = (allLanguages ?? [])
    .filter((item) => item.site_id === site.id)
    .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.position - b.position);
  const language =
    siteLanguages.find((item) => item.id === selection.languageId) ?? siteLanguages[0];
  if (!language) return null;
  const { data: pages, error: pagesError } = await client
    .from("pages")
    .select(
      "id, parent_id, title, slug, template_name, created_from_template_id, created_from_template_key, status, validation_status, position, is_homepage, preferred_child_template, updated_at",
    )
    .eq("site_language_id", language.id)
    .order("position");
  if (pagesError) throw pagesError;
  const rows = (pages ?? []) as CompactPage[];
  const latest = rows.reduce(
    (value, page) => (page.updated_at > value ? page.updated_at : value),
    language.updated_at > site.updated_at ? language.updated_at : site.updated_at,
  );
  const siteById = new Map(sites.map((item) => [item.id, item]));

  return {
    site: { id: site.id, name: site.name, slug: site.slug },
    language: { id: language.id, code: language.code, name: language.name },
    workspaces: (allLanguages ?? []).map((item) => ({
      siteId: item.site_id,
      siteName: siteById.get(item.site_id)?.name ?? "Site",
      languageId: item.id,
      languageName: item.name,
      languageCode: item.code,
    })),
    pages: buildTree(rows),
    pageCount: rows.length,
    lastUpdatedAt: latest,
  };
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "untitled-page"
  );
}

const duplicateChildUrl = "A page with this URL already exists under this parent.";

export async function createChildPage(input: {
  languageId: string;
  parentId: string;
  title: string;
  slug?: string;
  template: PageTemplateDefinition;
}) {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const base = slugify(input.slug || input.title);
  const { data: siblings, error: siblingError } = await client
    .from("pages")
    .select("slug, position")
    .eq("site_language_id", input.languageId)
    .eq("parent_id", input.parentId);
  if (siblingError) throw siblingError;
  const used = new Set((siblings ?? []).map((item) => item.slug));
  if (used.has(base)) throw new Error(duplicateChildUrl);
  const slug = base;
  const position = (siblings ?? []).reduce((max, item) => Math.max(max, item.position), -1) + 1;
  const { data, error } = await client
    .from("pages")
    .insert({
      site_language_id: input.languageId,
      parent_id: input.parentId,
      title: input.title.trim() || "Untitled page",
      slug,
      template_name: input.template.name,
      created_from_template_id: input.template.id ?? null,
      created_from_template_key: input.template.key,
      content_blocks: cloneTemplateComponentsForPage(input.template.components),
      seo_title: input.template.defaults.seoTitle,
      seo_description: input.template.defaults.seoDescription,
      status: "concept",
      validation_status: "needs_attention",
      position,
    })
    .select("id")
    .single();
  // A sibling with the same slug can be created between the check above and this insert.
  if (error?.code === "23505") throw new Error(duplicateChildUrl);
  if (error) throw error;

  return data.id;
}

export async function renamePage(pageId: string, title: string) {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const nextTitle = title.trim();
  if (!nextTitle) throw new Error("A page title is required.");
  // Renaming creates a concept revision, like any other save.
  const { error } = await client.rpc("rename_page", {
    target_page_id: pageId,
    target_title: nextTitle,
  });
  if (error) throw error;
}

/** Removes the page from delivery. Its concept and revision history are kept. */
export async function unpublishPage(pageId: string) {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const { error } = await client.rpc("unpublish_page", { target_page_id: pageId });
  if (error) throw error;
}

/** Deletes a leaf page. The database refuses the homepage and pages with children. */
export async function deletePage(pageId: string) {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const { error } = await client.rpc("delete_page", { target_page_id: pageId });
  if (error) throw error;
}

export type PageDropPosition = "before" | "inside" | "after";

export async function movePage(input: {
  pageId: string;
  targetId: string;
  position: PageDropPosition;
  createRedirects?: boolean;
}) {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const { data, error } = await client.rpc("move_page", {
    moving_page_id: input.pageId,
    target_page_id: input.targetId,
    drop_position: input.position,
    create_redirects: input.createRedirects ?? false,
  });
  if (error) throw error;

  return data as {
    reparented: boolean;
    parentTitle: string;
    affectedPages: number;
    publishedPages: number;
    redirectsCreated: number;
  };
}
