import { graphql } from "graphql";
import { describe, expect, it } from "vitest";

import { parseDeliveryBundle } from "@/domain/delivery";
import { createDeliveryGraphQLSchema } from "@/lib/delivery-graphql.server";

const bundle = parseDeliveryBundle({
  site: { id: "site-1", key: "northstar", name: "Northstar", timezone: "UTC", domains: [] },
  languages: [{ id: "en", code: "en", name: "English", default: true, urlPrefix: "" }],
  pages: [
    {
      id: "page-1",
      languageId: "en",
      locale: "en",
      title: "Home",
      slug: "",
      path: "/",
      templateName: "Landing page",
      blocks: [{ id: "hero", type: "hero", version: 1, data: { headline: "Hello" } }],
      seo: { title: "Home", description: "", socialImage: null },
      revisionId: "revision-1",
      revisionVersion: 2,
      publishedAt: "2026-07-22T10:00:00Z",
      createdAt: "2026-07-20T10:00:00Z",
      updatedAt: "2026-07-22T10:00:00Z",
    },
  ],
  contentTypes: [
    {
      id: "people",
      slug: "colleagues",
      name: "Colleagues",
      singularName: "Colleague",
      description: "",
      locale: "en",
      fields: [
        { key: "name", label: "Name", type: "text", required: true, primary: true, options: [] },
        {
          key: "featured",
          label: "Featured",
          type: "toggle",
          required: false,
          primary: false,
          options: [],
        },
      ],
      records: [
        {
          id: "person-1",
          contentType: "colleagues",
          locale: "en",
          values: { name: "Mara", featured: true },
          revisionId: "record-revision-1",
          revisionVersion: 1,
          publishedAt: "2026-07-22T10:00:00Z",
        },
      ],
    },
  ],
  navigation: [],
  redirects: [],
  media: [],
});

describe("delivery GraphQL schema", () => {
  it("uses one Page type with typed block variants", async () => {
    const result = await graphql({
      schema: createDeliveryGraphQLSchema(bundle),
      source: `{
        page(url: "/") {
          id title revisionVersion
          blocks { __typename ... on HeroBlock { id headline } }
        }
      }`,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.page).toMatchObject({
      id: "page-1",
      title: "Home",
      revisionVersion: 2,
      blocks: [{ __typename: "HeroBlock", id: "hero", headline: "Hello" }],
    });
  });

  it("generates strongly typed structured-content fields", async () => {
    const result = await graphql({
      schema: createDeliveryGraphQLSchema(bundle),
      source: `{ content { colleagues { nodes { id name featured } totalCount } } }`,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.content).toMatchObject({
      colleagues: { nodes: [{ id: "person-1", name: "Mara", featured: true }], totalCount: 1 },
    });
  });
});
