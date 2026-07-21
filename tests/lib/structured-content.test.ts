import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, mockResult } from "../helpers/supabase-mock";
import {
  createEmptyStructuredValues,
  recordMatchesSearch,
  seedStructuredTypes,
  type StructuredField,
  type StructuredRecord,
} from "@/lib/structured-content";
import {
  deleteStructuredRecord,
  deleteStructuredType,
  fieldKeyFromLabel,
  loadStructuredContentWorkspace,
  saveStructuredRecord,
  saveStructuredType,
  slugifyContentType,
} from "@/lib/structured-content-data";
import { getSupabaseBrowserClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: vi.fn(),
  getSupabaseConfigError: () => new Error("Supabase is not configured."),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("structured content helpers", () => {
  it("creates the correct empty value for every field shape", () => {
    const fields: StructuredField[] = [
      { id: "title", key: "title", label: "Title", type: "text" },
      { id: "featured", key: "featured", label: "Featured", type: "toggle" },
      { id: "tags", key: "tags", label: "Tags", type: "tags" },
    ];

    expect(createEmptyStructuredValues(fields)).toEqual({
      title: "",
      featured: false,
      tags: [],
    });
  });

  it("searches scalar and list values without case sensitivity", () => {
    const record: StructuredRecord = {
      id: "record-one",
      status: "published",
      updated: "Just now",
      values: {
        name: "Mara Jensen",
        skills: ["Editorial", "Localization"],
        featured: true,
      },
    };

    expect(recordMatchesSearch(record, "mara")).toBe(true);
    expect(recordMatchesSearch(record, "LOCALIZATION")).toBe(true);
    expect(recordMatchesSearch(record, "engineering")).toBe(false);
    expect(recordMatchesSearch(record, " ")).toBe(true);
  });

  it("seeds every content type with one primary display field", () => {
    const types = seedStructuredTypes();

    expect(types).toHaveLength(5);
    expect(types.every((type) => type.fields.length > 0)).toBe(true);
    expect(types.every((type) => type.fields.filter((field) => field.primary).length === 1)).toBe(
      true,
    );
  });

  it("creates stable URL slugs for custom content types", () => {
    expect(slugifyContentType("  FAQ Items  ")).toBe("faq-items");
    expect(slugifyContentType("!!!")).toBe("content-type");
  });

  it("creates safe field keys from labels", () => {
    expect(fieldKeyFromLabel("First name", 0)).toBe("firstName");
    expect(fieldKeyFromLabel("2026 target", 2)).toBe("field32026Target");
    expect(fieldKeyFromLabel("", 4)).toBe("field5");
  });
});

describe("structured content persistence", () => {
  it("loads and maps types, fields, records, options, and relative dates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
    const { client } = createSupabaseMock({
      tables: {
        sites: [mockResult([{ id: "site-1", name: "Site" }])],
        site_languages: [mockResult([{ id: "language-1", name: "English", code: "en" }])],
        content_types: [
          mockResult([
            {
              id: "type-1",
              site_language_id: "language-1",
              slug: "colleagues",
              name: "Colleagues",
              singular_name: "Colleague",
              icon: "ph-users",
              chip_bg: "#eee",
              chip_fg: "#222",
              description: "Team members",
              position: 0,
            },
          ]),
        ],
        content_fields: [
          mockResult([
            {
              id: "field-2",
              content_type_id: "type-1",
              key: "skills",
              label: "Skills",
              field_type: "tags",
              position: 2,
              is_primary: false,
              is_required: false,
              options: ["UI", 7, "CMS"],
            },
            {
              id: "field-1",
              content_type_id: "type-1",
              key: "name",
              label: "Name",
              field_type: "text",
              position: 1,
              is_primary: true,
              is_required: true,
              options: null,
            },
          ]),
        ],
        content_records: [
          mockResult([
            {
              id: "record-1",
              content_type_id: "type-1",
              status: "published",
              values: { name: "Mara", skills: ["UI", 3], ignored: 42 },
              updated_at: "2026-07-15T11:30:00.000Z",
            },
          ]),
        ],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);

    const workspace = await loadStructuredContentWorkspace();

    expect(workspace?.types[0]?.fields.map((field) => field.key)).toEqual(["name", "skills"]);
    expect(workspace?.types[0]?.fields[1]?.options).toEqual(["UI", "CMS"]);
    expect(workspace?.types[0]?.records[0]).toEqual({
      id: "record-1",
      status: "published",
      values: { name: "Mara" },
      updated: "30 min ago",
    });
    vi.useRealTimers();
  });

  it("returns null when the site or language is missing", async () => {
    const noSite = createSupabaseMock({ tables: { sites: [mockResult([])] } });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(noSite.client as never);
    await expect(loadStructuredContentWorkspace()).resolves.toBeNull();

    const noLanguage = createSupabaseMock({
      tables: {
        sites: [mockResult([{ id: "site-1", name: "Site" }])],
        site_languages: [mockResult([])],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(noLanguage.client as never);
    await expect(loadStructuredContentWorkspace()).resolves.toBeNull();
  });

  it("does not query fields or records when there are no content types", async () => {
    const { client } = createSupabaseMock({
      tables: {
        sites: [mockResult([{ id: "site-1", name: "Site" }])],
        site_languages: [mockResult([{ id: "language-1", name: "English", code: "en" }])],
        content_types: [mockResult([])],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);
    await expect(loadStructuredContentWorkspace()).resolves.toMatchObject({ types: [] });
    expect(client.from).toHaveBeenCalledTimes(3);
  });

  it("inserts and updates records while sanitizing stored JSON", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
    const { client, calls } = createSupabaseMock({
      tables: {
        content_records: [
          mockResult({
            id: "record-new",
            status: "concept",
            values: { title: "Draft", invalid: 8 },
            updated_at: "2026-07-15T12:00:00.000Z",
          }),
          mockResult({
            id: "record-new",
            status: "published",
            values: { title: "Published", featured: true },
            updated_at: "2026-07-14T12:00:00.000Z",
          }),
        ],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);
    const input = {
      contentTypeId: "type-1",
      languageId: "language-1",
      status: "concept" as const,
      values: { title: "Draft" },
    };

    await expect(saveStructuredRecord(input)).resolves.toEqual({
      id: "record-new",
      status: "concept",
      values: { title: "Draft" },
      updated: "Just now",
    });
    await expect(
      saveStructuredRecord({ ...input, id: "record-new", status: "published" }),
    ).resolves.toMatchObject({ status: "published", updated: "Yesterday" });
    expect(calls.some((call) => call.method === "insert")).toBe(true);
    expect(calls.some((call) => call.method === "update")).toBe(true);
    vi.useRealTimers();
  });

  it("saves type definitions through the RPC", async () => {
    const { client } = createSupabaseMock({ rpc: { save_content_type: [mockResult("type-1")] } });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);
    const fields: StructuredField[] = [
      {
        id: "field-1",
        key: "title",
        label: "Title",
        type: "text",
        primary: true,
        required: true,
      },
    ];

    await expect(
      saveStructuredType({
        languageId: "language-1",
        slug: "articles",
        name: "Articles",
        singular: "Article",
        icon: "ph-article",
        description: "Editorial content",
        fields,
      }),
    ).resolves.toBe("type-1");
    expect(client.rpc).toHaveBeenCalledWith(
      "save_content_type",
      expect.objectContaining({ target_type_id: null, target_slug: "articles" }),
    );
  });

  it("deletes records and content types", async () => {
    const { client } = createSupabaseMock({
      tables: {
        content_records: [mockResult(null)],
        content_types: [mockResult(null)],
      },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as never);
    await expect(deleteStructuredRecord("record-1")).resolves.toBeUndefined();
    await expect(deleteStructuredType("type-1")).resolves.toBeUndefined();
  });

  it("surfaces missing configuration and database errors", async () => {
    vi.mocked(getSupabaseBrowserClient).mockReturnValueOnce(null);
    await expect(loadStructuredContentWorkspace()).rejects.toThrow("not configured");

    const failure = createSupabaseMock({
      tables: { sites: [mockResult(null, new Error("sites failed"))] },
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(failure.client as never);
    await expect(loadStructuredContentWorkspace()).rejects.toThrow("sites failed");
  });
});
