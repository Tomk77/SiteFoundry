import { getSupabaseBrowserClient, getSupabaseConfigError } from "./supabase";
import type { Json } from "./database.types";

export const blockTypes = [
  "hero",
  "richtext",
  "quote",
  "image",
  "cta",
  "metrics",
  "steps",
  "feature",
  "pageList",
  "faq",
] as const;

export type BlockType = (typeof blockTypes)[number];
export interface ContentBlock {
  id: string;
  type: BlockType;
  data: Record<string, string>;
}

export interface PageRevisionSnapshot {
  title: string;
  slug: string;
  path: string;
  blocks: ContentBlock[];
  seoTitle: string;
  seoDescription: string;
  socialImage: string | null;
  preferredChildTemplate: string | null;
  validationStatus: "ready" | "needs_attention";
}

export interface ConceptRevision {
  id: string;
  version: number;
  createdAt: string;
}

export interface PublishedRevision {
  id: string;
  version: number;
  publishedAt: string;
  sourceConceptRevisionId: string | null;
  snapshot: PageRevisionSnapshot;
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
  conceptRevision: ConceptRevision | null;
  publishedRevision: PublishedRevision | null;
}

function isContentBlock(value: unknown): value is ContentBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as { id?: unknown; type?: unknown; data?: unknown };

  return (
    typeof block.id === "string" &&
    blockTypes.includes(block.type as BlockType) &&
    Boolean(block.data) &&
    typeof block.data === "object"
  );
}

function readPageSnapshot(value: unknown): PageRevisionSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Record<string, unknown>;
  const seo =
    snapshot.seo && typeof snapshot.seo === "object"
      ? (snapshot.seo as Record<string, unknown>)
      : {};

  return {
    title: typeof snapshot.title === "string" ? snapshot.title : "",
    slug: typeof snapshot.slug === "string" ? snapshot.slug : "",
    path: typeof snapshot.path === "string" ? snapshot.path : "/",
    blocks: Array.isArray(snapshot.blocks) ? snapshot.blocks.filter(isContentBlock) : [],
    seoTitle: typeof seo.title === "string" ? seo.title : "",
    seoDescription: typeof seo.description === "string" ? seo.description : "",
    socialImage: typeof seo.socialImage === "string" ? seo.socialImage : null,
    preferredChildTemplate:
      typeof snapshot.preferredChildTemplate === "string" ? snapshot.preferredChildTemplate : null,
    validationStatus: snapshot.validationStatus === "needs_attention" ? "needs_attention" : "ready",
  };
}

export function pageFromRevision(page: EditablePage, snapshot: PageRevisionSnapshot): EditablePage {
  return {
    ...page,
    ...snapshot,
    parentPath:
      snapshot.path === "/" ? "/" : snapshot.path.slice(0, snapshot.path.lastIndexOf("/") + 1),
    breadcrumbs: [...page.breadcrumbs.slice(0, -1), snapshot.title],
  };
}

export async function loadEditablePage(pageId?: string): Promise<EditablePage | null> {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();

  let query = client
    .from("pages")
    .select(
      "id, title, slug, parent_id, template_name, created_from_template_key, status, validation_status, content_blocks, seo_title, seo_description, social_image, preferred_child_template, site_language_id, created_at, updated_at, concept_revision_id, published_revision_id",
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

  let conceptRevision: ConceptRevision | null = null;
  if (page.concept_revision_id) {
    const { data: revision, error: revisionError } = await client
      .from("page_revisions")
      .select("id, version, created_at")
      .eq("id", page.concept_revision_id)
      .single();
    if (revisionError) throw revisionError;
    conceptRevision = {
      id: revision.id,
      version: revision.version,
      createdAt: revision.created_at,
    };
  }

  let publishedRevision: PublishedRevision | null = null;
  if (page.published_revision_id) {
    const { data: revision, error: revisionError } = await client
      .from("page_published_revisions")
      .select("id, version, snapshot, published_at, source_concept_revision_id")
      .eq("id", page.published_revision_id)
      .single();
    if (revisionError) throw revisionError;
    const snapshot = readPageSnapshot(revision.snapshot);
    if (snapshot) {
      publishedRevision = {
        id: revision.id,
        version: revision.version,
        publishedAt: revision.published_at,
        sourceConceptRevisionId: revision.source_concept_revision_id,
        snapshot,
      };
    }
  }

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
    conceptRevision,
    publishedRevision,
  };
}

export async function saveEditablePage(page: EditablePage, publish = false) {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const hasAccessibleImages = page.blocks.every((block) => {
    if (block.type === "image") return Boolean(block.data.alt?.trim());
    if ((block.type === "hero" || block.type === "feature") && block.data.imageSrc?.trim()) {
      return Boolean(block.data.imageAlt?.trim());
    }

    return true;
  });
  const validationStatus =
    page.seoDescription.trim() && hasAccessibleImages ? "ready" : "needs_attention";
  const { data, error } = await client.rpc("save_page_revision", {
    target_page_id: page.id,
    expected_concept_revision_id: page.conceptRevision?.id ?? null,
    target_title: page.title,
    target_slug: page.slug,
    target_content_blocks: page.blocks as unknown as Json,
    target_seo_title: page.seoTitle,
    target_seo_description: page.seoDescription,
    target_social_image: page.socialImage,
    target_preferred_child_template: page.preferredChildTemplate,
    target_validation_status: validationStatus,
    should_publish: publish,
  });
  if (error) throw error;
  const result = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const updatedAt = typeof result.updatedAt === "string" ? result.updatedAt : page.updatedAt;
  const conceptRevision =
    typeof result.conceptRevisionId === "string"
      ? {
          id: result.conceptRevisionId,
          version: Number(result.conceptRevisionVersion),
          createdAt: updatedAt,
        }
      : page.conceptRevision;

  return {
    updatedAt,
    status: (result.status ?? page.status) as EditablePage["status"],
    validationStatus: (result.validationStatus ??
      validationStatus) as EditablePage["validationStatus"],
    conceptRevision,
    publishedRevisionId:
      typeof result.publishedRevisionId === "string" ? result.publishedRevisionId : null,
    publishedRevisionVersion:
      typeof result.publishedRevisionVersion === "number" ? result.publishedRevisionVersion : null,
    publishedAt: typeof result.publishedAt === "string" ? result.publishedAt : null,
  };
}

export async function discardEditablePageConcept(pageId: string) {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const { error } = await client.rpc("discard_page_concept", { target_page_id: pageId });
  if (error) throw error;

  const page = await loadEditablePage(pageId);
  if (!page) throw new Error("The page was not found after discarding its concept.");

  return page;
}

export async function deleteEditablePage(pageId: string) {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();
  const { error } = await client.from("pages").delete().eq("id", pageId);
  if (error) throw error;
}
