import { describe, expect, it } from "vitest";
import {
  createEmptyStructuredValues,
  recordMatchesSearch,
  seedStructuredTypes,
  type StructuredField,
  type StructuredRecord,
} from "./structured-content";
import {
  fieldKeyFromLabel,
  slugifyContentType,
} from "./structured-content-data";

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
    expect(
      types.every(
        (type) => type.fields.filter((field) => field.primary).length === 1,
      ),
    ).toBe(true);
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
