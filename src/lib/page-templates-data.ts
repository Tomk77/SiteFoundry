import type { Json } from "./database.types";
import type { PageTemplateDefinition, PageTemplateRevision, TemplateValue } from "./page-templates";
import { PAGE_TEMPLATE_KEY_PATTERN } from "./page-templates";
import type { WorkspaceOption } from "./page-tree";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "./supabase";

export interface PageTemplateWorkspace {
  site: { id: string; name: string; slug: string };
  language: { id: string; code: string; name: string };
  workspaces: WorkspaceOption[];
  templates: PageTemplateDefinition[];
  pageCount: number;
}

interface WorkspacePayload {
  pageCount?: unknown;
  templates?: unknown;
}

function requireClient() {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();

  return client;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function templateValue(value: unknown): TemplateValue {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value;

  return null;
}

function normalizeTemplate(value: unknown): PageTemplateDefinition {
  if (!isRecord(value)) throw new Error("The database returned an invalid template definition.");
  const key = stringValue(value.key);
  if (!PAGE_TEMPLATE_KEY_PATTERN.test(key)) throw new Error(`Invalid template key: ${key}.`);
  const defaults = isRecord(value.defaults) ? value.defaults : {};
  const revisions: PageTemplateRevision[] = Array.isArray(value.revisions)
    ? value.revisions.flatMap((revision) =>
        isRecord(revision)
          ? [
              {
                version: Number(revision.version) || 1,
                note: stringValue(revision.note, "Template saved"),
                at: stringValue(revision.at, new Date().toISOString()),
              },
            ]
          : [],
      )
    : [];

  return {
    id: stringValue(value.id) || undefined,
    siteLanguageId: stringValue(value.siteLanguageId) || undefined,
    key,
    name: stringValue(value.name, key),
    description: stringValue(value.description),
    icon: stringValue(value.icon, "ph-file"),
    status: value.status === "published" ? "published" : "draft",
    fallback: Boolean(value.fallback),
    defaults: {
      seoTitle: stringValue(defaults.seoTitle),
      seoDescription: stringValue(defaults.seoDescription),
    },
    preview: stringValue(value.preview, `/preview/${key}`),
    components: Array.isArray(value.components)
      ? value.components.flatMap((component) => {
          if (!isRecord(component)) return [];
          const values = isRecord(component.values) ? component.values : {};

          return [
            {
              id: crypto.randomUUID(),
              type: stringValue(component.type),
              values: Object.fromEntries(
                Object.entries(values).map(([fieldKey, fieldValue]) => [
                  fieldKey,
                  templateValue(fieldValue),
                ]),
              ),
            },
          ];
        })
      : [],
    revisions,
    modifiedAt: stringValue(value.modifiedAt) || undefined,
    usageCount: Number(value.usageCount) || 0,
  };
}

async function templatePayload(languageId: string) {
  const client = requireClient();
  const { data, error } = await client.rpc("get_page_template_workspace", {
    target_language_id: languageId,
  });
  if (error) throw error;
  const payload = isRecord(data) ? (data as WorkspacePayload) : {};

  return {
    pageCount: Number(payload.pageCount) || 0,
    templates: Array.isArray(payload.templates) ? payload.templates.map(normalizeTemplate) : [],
  };
}

export async function loadPageTemplateWorkspace(
  selection: { siteId?: string; languageId?: string } = {},
): Promise<PageTemplateWorkspace | null> {
  const client = requireClient();
  const [sitesResult, languagesResult] = await Promise.all([
    client.from("sites").select("id, name, slug, created_at").order("created_at"),
    client
      .from("site_languages")
      .select("id, site_id, code, name, is_default, position")
      .order("position"),
  ]);
  if (sitesResult.error) throw sitesResult.error;
  if (languagesResult.error) throw languagesResult.error;
  const sites = sitesResult.data ?? [];
  const languages = languagesResult.data ?? [];
  const site = sites.find((item) => item.id === selection.siteId) ?? sites[0];
  if (!site) return null;
  const siteLanguages = languages
    .filter((item) => item.site_id === site.id)
    .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.position - b.position);
  const language =
    siteLanguages.find((item) => item.id === selection.languageId) ?? siteLanguages[0];
  if (!language) return null;
  const payload = await templatePayload(language.id);
  const siteById = new Map(sites.map((item) => [item.id, item]));

  return {
    site: { id: site.id, name: site.name, slug: site.slug },
    language: { id: language.id, code: language.code, name: language.name },
    workspaces: languages.map((item) => ({
      siteId: item.site_id,
      siteName: siteById.get(item.site_id)?.name ?? "Site",
      languageId: item.id,
      languageName: item.name,
      languageCode: item.code,
    })),
    templates: payload.templates,
    pageCount: payload.pageCount,
  };
}

export async function loadPageTemplates(languageId: string) {
  return (await templatePayload(languageId)).templates;
}

export async function savePageTemplate(input: {
  languageId: string;
  template: PageTemplateDefinition;
}) {
  const client = requireClient();
  const template = input.template;
  const { data, error } = await client.rpc("save_page_template", {
    target_language_id: input.languageId,
    target_template_id: template.id ?? null,
    target_key: template.key,
    target_name: template.name,
    target_description: template.description,
    target_icon: template.icon,
    target_status: template.status,
    target_is_fallback: template.fallback,
    target_defaults: template.defaults as Json,
    target_preview_path: template.preview,
    target_components: template.components.map(({ type, values }) => ({ type, values })) as Json,
  });
  if (error) throw error;

  return data;
}

export async function setFallbackPageTemplate(languageId: string, templateId: string) {
  const client = requireClient();
  const { error } = await client.rpc("set_fallback_page_template", {
    target_language_id: languageId,
    target_template_id: templateId,
  });
  if (error) throw error;
}

export async function deletePageTemplate(languageId: string, templateId: string) {
  const client = requireClient();
  const { error } = await client.rpc("delete_page_template", {
    target_language_id: languageId,
    target_template_id: templateId,
  });
  if (error) throw error;
}
