// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleDeliveryGraphQLRequest } from "@/lib/delivery-graphql.server";

const token = "scaffold_pub_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
const endpoint = "http://cms.test/api/v1/sites/site-one/graphql";
const bundle = {
  site: { id: "site-1", key: "site-one", name: "Site one", timezone: "UTC", domains: [] },
  languages: [{ id: "language-1", code: "en", name: "English", default: true, urlPrefix: "" }],
  pages: [],
  contentTypes: [],
  navigation: [],
  redirects: [],
  media: [],
};

beforeEach(() => {
  process.env.VITE_SUPABASE_URL = "http://supabase.test";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () => new Response(JSON.stringify(bundle), { status: 200 })),
  );
});

afterEach(() => vi.unstubAllGlobals());

const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

describe("delivery GraphQL HTTP handling (3.7)", () => {
  it("answers a query", async () => {
    const response = await handleDeliveryGraphQLRequest(
      new Request(endpoint, { method: "POST", headers, body: '{"query":"{ site { name } }"}' }),
      "site-one",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { site: { name: "Site one" } } });
  });

  it("returns 400 for invalid variables JSON in a GET request", async () => {
    const url = `${endpoint}?query=${encodeURIComponent("{ site { name } }")}&variables={broken`;
    const response = await handleDeliveryGraphQLRequest(new Request(url, { headers }), "site-one");

    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe("invalid_variables");
  });

  it("returns 400 for a body that is not JSON", async () => {
    const response = await handleDeliveryGraphQLRequest(
      new Request(endpoint, { method: "POST", headers, body: "{not json" }),
      "site-one",
    );

    expect(response.status).toBe(400);
  });

  it("enforces the size limit on the body itself, not only on Content-Length", async () => {
    const body = JSON.stringify({ query: `{ site { name } } #${"x".repeat(120_000)}` });
    const response = await handleDeliveryGraphQLRequest(
      new Request(endpoint, { method: "POST", headers, body }),
      "site-one",
    );

    expect(response.status).toBe(413);
  });

  it("answers other methods with 405 and an Allow header", async () => {
    const response = await handleDeliveryGraphQLRequest(
      new Request(endpoint, { method: "PUT", headers, body: "{}" }),
      "site-one",
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, POST, OPTIONS");
  });
});
