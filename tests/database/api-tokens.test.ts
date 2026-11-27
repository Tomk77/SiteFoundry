// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addMember, createOwnerSite, type SiteFixture } from "./fixtures";
import { createMigratedDatabase, expectDenied, type TestDatabase } from "./harness";

let database: TestDatabase;
let site: SiteFixture;
let adminId: string;

const browserHash = "a".repeat(64);

beforeEach(async () => {
  database = await createMigratedDatabase();
  site = await createOwnerSite(database);
  adminId = await addMember(database, site.siteId, "admin");
}, 120_000);

afterEach(() => database.close());

async function createToken(
  userId: string,
  origins: string[] = [],
  expiresAt: string | null = null,
) {
  const result = await database.as(userId, (tx) =>
    tx.query<{ created: { id: string; token: string } }>(
      "select public.create_site_api_token($1, 'Website', $2, $3) as created",
      [site.siteId, origins, expiresAt],
    ),
  );
  const created = result.rows[0]?.created;

  if (!created) throw new Error("No token returned");

  return created;
}

describe("1.5 API tokens", () => {
  it("does not accept a browser-supplied token hash", async () => {
    await expectDenied(() =>
      database.as(adminId, (tx) =>
        tx.query(
          `insert into public.site_api_tokens (site_id, name, token_hash, token_prefix, token_suffix, created_by)
           values ($1, 'Website', $2, 'scaffold_pub_', 'aaaa', $3)`,
          [site.siteId, browserHash, adminId],
        ),
      ),
    );
  });

  it("does not let a settings manager un-revoke or re-tune a token directly", async () => {
    const created = await createToken(adminId);

    await database.as(adminId, (tx) =>
      tx.query("select public.revoke_site_api_token($1)", [created.id]),
    );

    for (const assignment of [
      "revoked_at = null",
      "rate_limit_per_minute = 6000",
      "rate_request_count = 0",
      "expires_at = now() + interval '10 years'",
      `token_hash = '${browserHash}'`,
    ]) {
      await expectDenied(() =>
        database.as(adminId, (tx) =>
          tx.query(`update public.site_api_tokens set ${assignment} where id = $1`, [created.id]),
        ),
      );
    }
  });

  it("generates the secret in the database and stores only its SHA-256 hash", async () => {
    const created = await createToken(adminId, ["https://example.test"]);
    const [row] = await database.admin<{
      matches: boolean;
      token_prefix: string;
      token_suffix: string;
      created_by: string;
      allowed_origins: string[];
    }>(
      `select token_hash = encode(sha256(convert_to($2, 'utf8')), 'hex') as matches,
              token_prefix, token_suffix, created_by, allowed_origins
       from public.site_api_tokens where id = $1`,
      [created.id, created.token],
    );

    expect(created.token).toMatch(/^scaffold_pub_[A-Za-z0-9_-]{43}$/);
    expect(row).toEqual({
      matches: true,
      token_prefix: created.token.slice(0, 17),
      token_suffix: created.token.slice(-4),
      created_by: adminId,
      allowed_origins: ["https://example.test"],
    });
  });

  it("issues tokens that the delivery API accepts until they are revoked", async () => {
    const created = await createToken(adminId);
    const deliver = () =>
      database.as(null, (tx) =>
        tx.query("select public.get_delivery_bundle($1, $2, null)", [site.siteSlug, created.token]),
      );

    await deliver();
    await database.as(adminId, (tx) =>
      tx.query("select public.revoke_site_api_token($1)", [created.id]),
    );
    expect(await expectDenied(deliver)).toContain("Invalid delivery token");
  });

  it("3.5 rejects a leaked token hash in place of the token", async () => {
    const created = await createToken(adminId);
    const message = await expectDenied(() =>
      database.as(null, (tx) =>
        tx.query(
          "select public.get_delivery_bundle($1, encode(sha256(convert_to($2, 'utf8')), 'hex'), null)",
          [site.siteSlug, created.token],
        ),
      ),
    );

    expect(message).toContain("Invalid delivery token");
  });

  it("3.9 stores a prefix that tells tokens apart", async () => {
    const created = await createToken(adminId);
    const [row] = await database.admin<{ token_prefix: string }>(
      "select token_prefix from public.site_api_tokens where id = $1",
      [created.id],
    );

    expect(row?.token_prefix).toBe(created.token.slice(0, 17));
  });

  it("only lets settings managers create and revoke tokens", async () => {
    const editorId = await addMember(database, site.siteId, "editor");
    const created = await createToken(adminId);

    await expectDenied(() => createToken(editorId));
    await expectDenied(() =>
      database.as(editorId, (tx) =>
        tx.query("select public.revoke_site_api_token($1)", [created.id]),
      ),
    );
  });

  it("rejects an expiry in the past and malformed origins", async () => {
    await expectDenied(() => createToken(adminId, [], "2000-01-01T00:00:00Z"));
    await expectDenied(() => createToken(adminId, ["https://example.test/path"]));
  });
});
