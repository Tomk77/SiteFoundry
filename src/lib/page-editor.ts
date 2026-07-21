import { getSupabaseBrowserClient, getSupabaseConfigError } from "./supabase";

export type BlockType = "hero" | "richtext" | "quote" | "image" | "cta";
export interface ContentBlock {
  id: string;
  type: BlockType;
  data: Record<string, string>;
}

export interface EditablePage {
  id: string;
  title: string;
  slug: string;
  path: string;
  parentPath: string;
  parentTitle: string | null;
  breadcrumbs: string[];
  templateName: string;
  templateKey: string | null;
  status: "concept" | "published";
  validationStatus: "ready" | "needs_attention";
  blocks: ContentBlock[];
  seoTitle: string;
  seoDescription: string;
  socialImage: string | null;
  preferredChildTemplate: string | null;
  siteLanguageId: string;
  language: { code: string; name: string };
  siteName: string;
  createdAt: string;
  updatedAt: string;
}

function isContentBlock(value: unknown): value is ContentBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as { id?: unknown; type?: unknown; data?: unknown };

  return (
    typeof block.id === "string" &&
    ["hero", "richtext", "quote", "image", "cta"].includes(String(block.type)) &&
    Boolean(block.data) &&
    typeof block.data === "object"
  );
}

export async function loadEditablePage(pageId?: string): Promise<EditablePage | null> {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();

  let query = client
    .from("pages")
    .select(
      "id, title, slug, parent_id, template_name, created_from_template_key, status, validation_status, content_blocks, seo_title, seo_description, social_image, preferred_child_template, site_language_id, created_at, updated_at",
    );
  query = pageId ? query.eq("id", pageId) : query.eq("slug", "product-launch");
  const { data: page, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  if (!page) return null;

  const { data: language, error: languageError } = await client
    .from("site_languages")
    .select("code, name, site_id")
    .eq("id", page.site_language_id)
    .single();
  if (languageError) throw languageError;
  const { data: site, error: siteError } = await client
    .from("sites")
    .select("name")
    .eq("id", language.site_id)
    .single();
  if (siteError) throw siteError;

  const ancestors: { title: string; slug: string }[] = [];
  let parentId = page.parent_id;
  while (parentId) {
    const { data: parent, error: parentError } = await client
      .from("pages")
      .select("id, title, slug, parent_id, is_homepage")
      .eq("id", parentId)
      .single();
    if (parentError) throw parentError;
    ancestors.unshift({
      title: parent.title,
      slug: parent.is_homepage ? "" : parent.slug,
    });
    parentId = parent.parent_id;
  }

  const segments = ancestors.map((ancestor) => ancestor.slug).filter(Boolean);
  const parentPath = segments.length ? `/${segments.join("/")}/` : "/";
  const path = page.slug ? `${parentPath}${page.slug}`.replace(/\/+/g, "/") : "/";

  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    path,
    parentPath,
    parentTitle: ancestors.at(-1)?.title ?? null,
    breadcrumbs: [...ancestors.map((ancestor) => ancestor.title), page.title],
    templateName: page.template_name,
    templateKey: page.created_from_template_key,
    status: page.status as EditablePage["status"],
    validationStatus: page.validation_status as EditablePage["validationStatus"],
    blocks: Array.isArray(page.content_blocks) ? page.content_blocks.filter(isContentBlock) : [],
    seoTitle: page.seo_title,
    seoDescription: page.seo_description,
    socialImage: page.social_image,
    preferredChildTemplate: page.preferred_child_template,
    siteLanguageId: page.site_language_id,
    language,
    siteName: site.name,
    createdAt: page.created_at,
    updatedAt: page.updated_at,
  };
}

export async function saveEditablePage(page: EditablePage, publish = false) {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const status = publish ? "published" : page.status;
  const validationStatus =
    page.seoDescription.trim() &&
    page.blocks.every((block) => block.type !== "image" || block.data.alt?.trim())
      ? "ready"
      : "needs_attention";
  const { data, error } = await client
    .from("pages")
    .update({
      title: page.title,
      slug: page.slug,
      content_blocks: page.blocks,
      seo_title: page.seoTitle,
      seo_description: page.seoDescription,
      social_image: page.socialImage,
      preferred_child_template: page.preferredChildTemplate,
      status,
      validation_status: validationStatus,
    })
    .eq("id", page.id)
    .select("updated_at, status, validation_status")
    .single();
  if (error) throw error;

  return {
    updatedAt: data.updated_at,
    status: data.status as EditablePage["status"],
    validationStatus: data.validation_status as EditablePage["validationStatus"],
  };
}

export async function deleteEditablePage(pageId: string) {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const { error } = await client.from("pages").delete().eq("id", pageId);
  if (error) throw error;
}
