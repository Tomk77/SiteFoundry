import { describe, expect, it } from "vitest";
import {
  cloneTemplateComponentsForPage,
  createTemplateComponent,
  pageComponentRegistry,
  slugifyTemplateKey,
  templateComponentSummary,
  validatePageTemplate,
  type PageTemplateDefinition,
} from "./page-templates";

const validTemplate: PageTemplateDefinition = {
  key: "standard-page",
  name: "Standard page",
  description: "A reusable starting point.",
  icon: "ph-file",
  status: "published",
  fallback: true,
  defaults: { seoTitle: "", seoDescription: "" },
  preview: "/preview/standard",
  components: [
    { type: "hero", values: { headline: "Page title", align: "Left", fullBleed: false } },
    { type: "richtext", values: { body: "Start writing here." } },
  ],
  revisions: [],
};

describe("page templates", () => {
  it("creates stable URL-safe keys", () => {
    expect(slugifyTemplateKey("  News & Press  ")).toBe("news-press");
  });

  it("accepts a valid registered component structure", () => {
    expect(validatePageTemplate(validTemplate)).toEqual([]);
  });

  it("creates defaults for every supported template field kind", () => {
    pageComponentRegistry["all-fields"] = {
      label: "All fields",
      icon: "ph-file",
      category: "Test",
      description: "Covers field defaults",
      iconClass: "test",
      fields: [
        { key: "count", label: "Count", type: "number" },
        { key: "tags", label: "Tags", type: "tags" },
        { key: "enabled", label: "Enabled", type: "toggle" },
        { key: "choice", label: "Choice", type: "choice", options: [] },
        { key: "title", label: "Title", type: "text" },
      ],
    };
    const component = createTemplateComponent("hero");
    expect(component.id).toEqual(expect.any(String));
    expect(component.values).toMatchObject({ align: "Left", fullBleed: false });
    expect(createTemplateComponent("all-fields").values).toEqual({
      count: 0,
      tags: [],
      enabled: false,
      choice: "",
      title: "",
    });
    expect(createTemplateComponent("unknown").values).toEqual({});
    delete pageComponentRegistry["all-fields"];
  });

  it("requires a fallback template to be published", () => {
    expect(validatePageTemplate({ ...validTemplate, status: "draft" })).toContainEqual({
      message: "The fallback template must be published.",
    });
  });

  it("reports unknown components, required values, and invalid URLs", () => {
    const template: PageTemplateDefinition = {
      ...validTemplate,
      key: "Bad key",
      components: [
        { type: "spotlight", values: { legacy: "kept" } },
        { type: "hero", values: { headline: "" } },
        {
          type: "cta",
          values: { heading: "Join", buttonHref: "relative-path" },
        },
      ],
    };
    expect(validatePageTemplate(template).map((issue) => issue.message)).toEqual([
      "Keys use lowercase letters, numbers and hyphens, and start with a letter.",
      'Unknown component "spotlight"',
      "Headline is required",
      "Use an absolute path or full URL",
    ]);
  });

  it("copies template content into independent page blocks with fresh ids", () => {
    const first = cloneTemplateComponentsForPage(validTemplate.components);
    const second = cloneTemplateComponentsForPage(validTemplate.components);
    expect(first.map((block) => block.type)).toEqual(["hero", "richtext"]);
    expect(first[0]?.data).toEqual(validTemplate.components[0]?.values);
    expect(first[0]?.id).not.toBe(second[0]?.id);
    expect(first[0]?.data).not.toBe(validTemplate.components[0]?.values);
  });

  it("summarizes repeated components for dense tables and pickers", () => {
    expect(
      templateComponentSummary({
        ...validTemplate,
        components: [...validTemplate.components, validTemplate.components[1]!],
      }),
    ).toBe("Hero, Rich text × 2");
  });
});
