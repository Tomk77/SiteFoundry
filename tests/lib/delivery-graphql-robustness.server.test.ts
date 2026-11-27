import { graphql } from "graphql";
import { describe, expect, it } from "vitest";

import { parseDeliveryBundle } from "@/domain/delivery";
import { createDeliveryGraphQLSchema, enforceQueryLimits } from "@/lib/delivery-graphql.server";

function bundleWith(overrides: Record<string, unknown>) {
  return parseDeliveryBundle({
    site: { id: "site-1", key: "northstar", name: "Northstar", timezone: "UTC", domains: [] },
    languages: [{ id: "en", code: "en", name: "English", default: true, urlPrefix: "" }],
    pages: [],
    contentTypes: [],
    navigation: [],
    redirects: [],
    media: [],
    ...overrides,
  });
}

function contentType(slug: string, fields: unknown[], values: Record<string, unknown>) {
  return {
    id: `type-${slug}`,
    slug,
    name: slug,
    singularName: slug,
    description: "",
    locale: "en",
    fields,
    records: [
      {
        id: `${slug}-1`,
        contentType: slug,
        locale: "en",
        values,
        revisionId: "revision-1",
        revisionVersion: 1,
        publishedAt: "2026-11-27T10:00:00Z",
      },
    ],
  };
}

const field = (key: string, type: string, required = true) => ({
  key,
  label: key,
  type,
  required,
  primary: false,
  options: [],
});

describe("3.3 one bad value does not null the whole response", () => {
  it("returns null for a missing required value or a number stored as text", async () => {
    const bundle = bundleWith({
      contentTypes: [
        contentType("people", [field("name", "text"), field("age", "number")], { age: "" }),
      ],
    });
    const result = await graphql({
      schema: createDeliveryGraphQLSchema(bundle),
      source: "{ site { name } content { people { nodes { id name age } } } }",
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toMatchObject({
      site: { name: "Northstar" },
      content: { people: { nodes: [{ id: "people-1", name: null, age: null }] } },
    });
  });

  it("returns an empty string for a missing required block field", async () => {
    const bundle = bundleWith({
      pages: [
        {
          id: "page-1",
          languageId: "en",
          locale: "en",
          title: "Home",
          slug: "",
          path: "/",
          templateName: "Landing page",
          blocks: [{ id: "hero", type: "hero", version: 1, data: {} }],
          seo: { title: "Home", description: "", socialImage: null },
          revisionId: "revision-1",
          revisionVersion: 1,
          publishedAt: "2026-11-27T10:00:00Z",
        },
      ],
    });
    const result = await graphql({
      schema: createDeliveryGraphQLSchema(bundle),
      source: '{ page(url: "/") { blocks { ... on HeroBlock { headline } } } }',
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.page).toEqual({ blocks: [{ headline: "" }] });
  });
});

describe("3.4 generated names never collide", () => {
  it("builds a schema for a content type called page", () => {
    const bundle = bundleWith({
      contentTypes: [contentType("page", [field("title", "text")], {})],
    });

    expect(() => createDeliveryGraphQLSchema(bundle)).not.toThrow();
  });

  it("keeps system record fields when a content field uses their key", async () => {
    const bundle = bundleWith({
      contentTypes: [
        contentType("people", [field("id", "text"), field("locale", "text")], {
          id: "custom",
          locale: "custom",
        }),
      ],
    });
    const result = await graphql({
      schema: createDeliveryGraphQLSchema(bundle),
      source: "{ content { people { nodes { id locale idField localeField } } } }",
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.content).toEqual({
      people: {
        nodes: [{ id: "people-1", locale: "en", idField: "custom", localeField: "custom" }],
      },
    });
  });
});

describe("renamed system-key fields never overwrite another field (review of #10)", () => {
  it("keeps both values when a type has id and idField", async () => {
    const bundle = bundleWith({
      contentTypes: [
        contentType("people", [field("id", "text"), field("idField", "text")], {
          id: "custom",
          idField: "existing",
        }),
      ],
    });
    const result = await graphql({
      schema: createDeliveryGraphQLSchema(bundle),
      source: "{ content { people { nodes { id idField idField2 } } } }",
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.content).toEqual({
      people: { nodes: [{ id: "people-1", idField: "existing", idField2: "custom" }] },
    });
  });
});

describe("3.10 limits count fragments after expansion", () => {
  it("rejects a deep query hidden in fragments", () => {
    const fragments = Array.from(
      { length: 14 },
      (_, index) => `fragment F${index} on Query { site { ...F${index + 1} } }`,
    ).join("\n");
    const source = `{ ...F0 }\n${fragments}\nfragment F14 on Query { site { name } }`;

    expect(() => enforceQueryLimits(source)).toThrow("too deep");
  });

  it("rejects many fields multiplied by repeated fragment spreads", () => {
    const fields = Array.from({ length: 30 }, () => "name").join(" ");
    const spreads = Array.from({ length: 20 }, () => "...Many").join(" ");
    const source = `{ site { ${spreads} } }\nfragment Many on Site { ${fields} }`;

    expect(() => enforceQueryLimits(source)).toThrow("too complex");
  });

  it("does not loop on a fragment that spreads itself", () => {
    expect(() =>
      enforceQueryLimits("{ ...Loop } fragment Loop on Query { ...Loop }"),
    ).not.toThrow();
  });
});
