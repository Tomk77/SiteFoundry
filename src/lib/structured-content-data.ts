import type { Json } from "./database.types";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "./supabase";
import type {
  StructuredField,
  StructuredFieldType,
  StructuredRecord,
  StructuredType,
  StructuredValue,
} from "./structured-content";

export interface StructuredContentWorkspace {
  site: { id: string; name: string };
  language: { id: string; name: string; code: string };
  types: StructuredType[];
}

interface TypeRow {
  id: string;
  site_language_id: string;
  slug: string;
  name: string;
  singular_name: string;
  icon: string;
  chip_bg: string;
  chip_fg: string;
  description: string;
  position: number;
}

interface FieldRow {
  id: string;
  content_type_id: string;
  key: string;
  label: string;
  field_type: string;
  position: number;
  is_primary: boolean;
  is_required: boolean;
  options: Json;
}

interface RecordRow {
  id: string;
  content_type_id: string;
  status: string;
  values: Json;
  updated_at: string;
}

function requireClient() {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();

  return client;
}

function relativeTime(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);

  return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
}

function optionsFromJson(value: Json): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function valuesFromJson(value: Json): Record<string, StructuredValue> {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, StructuredValue] => {
      const item = entry[1];

      return (
        typeof item === "string" ||
        typeof item === "boolean" ||
        (Array.isArray(item) && item.every((part) => typeof part === "string"))
      );
    }),
  );
}

function mapWorkspaceTypes(typeRows: TypeRow[], fieldRows: FieldRow[], recordRows: RecordRow[]) {
  return typeRows.map<StructuredType>((type) => ({
    id: type.id,
    slug: type.slug,
    name: type.name,
    singular: type.singular_name,
    icon: type.icon,
    chipBg: type.chip_bg,
    chipFg: type.chip_fg,
    description: type.description,
    fields: fieldRows
      .filter((field) => field.content_type_id === type.id)
      .sort((a, b) => a.position - b.position)
      .map((field) => ({
        id: field.id,
        key: field.key,
        label: field.label,
        type: field.field_type as StructuredFieldType,
        primary: field.is_primary,
        required: field.is_required,
        options: optionsFromJson(field.options),
      })),
    records: recordRows
      .filter((record) => record.content_type_id === type.id)
      .map((record) => ({
        id: record.id,
        status: record.status === "published" ? "published" : "concept",
        values: valuesFromJson(record.values),
        updated: relativeTime(record.updated_at),
      })),
  }));
}

export async function loadStructuredContentWorkspace(): Promise<StructuredContentWorkspace | null> {
  const client = requireClient();
  const { data: sites, error: sitesError } = await client
    .from("sites")
    .select("id, name")
    .order("created_at")
    .limit(1);
  if (sitesError) throw sitesError;
  const site = sites?.[0];
  if (!site) return null;

  const { data: languages, error: languageError } = await client
    .from("site_languages")
    .select("id, name, code, is_default, position")
    .eq("site_id", site.id)
    .order("is_default", { ascending: false })
    .order("position")
    .limit(1);
  if (languageError) throw languageError;
  const language = languages?.[0];
  if (!language) return null;

  const { data: typeData, error: typeError } = await client
    .from("content_types")
    .select(
      "id, site_language_id, slug, name, singular_name, icon, chip_bg, chip_fg, description, position",
    )
    .eq("site_language_id", language.id)
    .order("position")
    .order("name");
  if (typeError) throw typeError;
  const typeRows = (typeData ?? []) as TypeRow[];
  const typeIds = typeRows.map((type) => type.id);

  let fieldRows: FieldRow[] = [];
  let recordRows: RecordRow[] = [];
  if (typeIds.length) {
    const [fieldsResult, recordsResult] = await Promise.all([
      client
        .from("content_fields")
        .select(
          "id, content_type_id, key, label, field_type, position, is_primary, is_required, options",
        )
        .in("content_type_id", typeIds)
        .order("position"),
      client
        .from("content_records")
        .select("id, content_type_id, status, values, updated_at")
        .in("content_type_id", typeIds)
        .order("updated_at", { ascending: false }),
    ]);
    if (fieldsResult.error) throw fieldsResult.error;
    if (recordsResult.error) throw recordsResult.error;
    fieldRows = fieldsResult.data ?? [];
    recordRows = recordsResult.data ?? [];
  }

  return {
    site,
    language,
    types: mapWorkspaceTypes(typeRows, fieldRows, recordRows),
  };
}

export async function saveStructuredRecord(input: {
  id?: string;
  contentTypeId: string;
  languageId: string;
  status: "published" | "concept";
  values: Record<string, StructuredValue>;
}) {
  const client = requireClient();
  const payload = {
    content_type_id: input.contentTypeId,
    site_language_id: input.languageId,
    status: input.status,
    values: input.values as Json,
  };
  const result = input.id
    ? await client
        .from("content_records")
        .update(payload)
        .eq("id", input.id)
        .select("id, content_type_id, status, values, updated_at")
        .single()
    : await client
        .from("content_records")
        .insert(payload)
        .select("id, content_type_id, status, values, updated_at")
        .single();
  if (result.error) throw result.error;
  const row = result.data;

  return {
    id: row.id,
    status: row.status === "published" ? "published" : "concept",
    values: valuesFromJson(row.values),
    updated: relativeTime(row.updated_at),
  } satisfies StructuredRecord;
}

export async function deleteStructuredRecord(id: string) {
  const client = requireClient();
  const { error } = await client.from("content_records").delete().eq("id", id);
  if (error) throw error;
}

export function slugifyContentType(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "content-type"
  );
}

export function fieldKeyFromLabel(value: string, index: number) {
  const words = value.trim().match(/[a-zA-Z0-9]+/g) ?? [];
  if (!words.length) return `field${index + 1}`;
  const [first = "field", ...rest] = words;
  const key =
    first.toLowerCase() +
    rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");

  return /^[a-z]/.test(key) ? key : `field${index + 1}${key}`;
}

export async function saveStructuredType(input: {
  id?: string;
  languageId: string;
  slug: string;
  name: string;
  singular: string;
  icon: string;
  description: string;
  fields: StructuredField[];
}) {
  const client = requireClient();
  const { data, error } = await client.rpc("save_content_type", {
    target_language_id: input.languageId,
    target_type_id: input.id ?? null,
    target_slug: input.slug,
    target_name: input.name,
    target_singular_name: input.singular,
    target_icon: input.icon,
    target_description: input.description,
    target_fields: input.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      primary: Boolean(field.primary),
      required: Boolean(field.required),
      options: field.options ?? [],
    })) as Json,
  });
  if (error) throw error;
  // Delivery reads the published schema; saving a type publishes its new structure.
  const { error: publishError } = await client.rpc("publish_content_type_schema", {
    target_content_type_id: data,
  });
  if (publishError) throw publishError;

  return data;
}

export async function deleteStructuredType(id: string) {
  const client = requireClient();
  const { error } = await client.from("content_types").delete().eq("id", id);
  if (error) throw error;
}
