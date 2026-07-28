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
      blocks: [
        {
          id: "hero",
          type: "hero",
          version: 1,
          data: { headline: "Hello", highlights: "Typed API\nPage tree" },
        },
        {
          id: "metrics",
          type: "metrics",
          version: 1,
          data: { items: "4 | published pages\nREST + GraphQL | typed delivery" },
        },
        {
          id: "steps",
          type: "steps",
          version: 1,
          data: { heading: "Four moves", items: "tree | Model pages | Keep URLs aligned" },
        },
        {
          id: "feature",
          type: "feature",
          version: 1,
          data: {
            title: "Redirect safely",
            points: "Loop detection\nPublished redirects",
            redirects: "/old | /new | 301",
            recordFields: "Name | Amina",
          },
        },
        {
          id: "page-list",
          type: "pageList",
          version: 1,
          data: { heading: "Published routes", maxItems: "6" },
        },
        {
          id: "faq",
          type: "faq",
          version: 1,
          data: { heading: "Questions", items: "What is it? | A website-native CMS." },
        },
      ],
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
    });
    const page = result.data?.page as { blocks: Array<Record<string, unknown>> };
    expect(page.blocks[0]).toMatchObject({
      __typename: "HeroBlock",
      id: "hero",
      headline: "Hello",
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

  it("parses marketing block line fields into strongly typed values", async () => {
    const result = await graphql({
      schema: createDeliveryGraphQLSchema(bundle),
      source: `{
        page(url: "/") {
          blocks {
            __typename
            ... on HeroBlock { highlights }
            ... on MetricsBlock { metrics { value label } }
            ... on StepsBlock { heading steps { icon title body } }
            ... on FeatureBlock {
              title points
              redirects { source destination statusCode }
              recordFields { label value }
            }
            ... on PageListBlock { heading maxItems }
            ... on FaqBlock { heading questions { question answer } }
          }
        }
      }`,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.page).toMatchObject({
      blocks: [
        { __typename: "HeroBlock", highlights: ["Typed API", "Page tree"] },
        {
          __typename: "MetricsBlock",
          metrics: [
            { value: "4", label: "published pages" },
            { value: "REST + GraphQL", label: "typed delivery" },
          ],
        },
        {
          __typename: "StepsBlock",
          heading: "Four moves",
          steps: [{ icon: "tree", title: "Model pages", body: "Keep URLs aligned" }],
        },
        {
          __typename: "FeatureBlock",
          points: ["Loop detection", "Published redirects"],
          redirects: [{ source: "/old", destination: "/new", statusCode: 301 }],
          recordFields: [{ label: "Name", value: "Amina" }],
        },
        { __typename: "PageListBlock", heading: "Published routes", maxItems: 6 },
        {
          __typename: "FaqBlock",
          heading: "Questions",
          questions: [{ question: "What is it?", answer: "A website-native CMS." }],
        },
      ],
    });
  });
});
