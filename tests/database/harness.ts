import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = resolve(import.meta.dirname, "../..");
const migrationsDirectory = resolve(root, "supabase/migrations");

// 20260728152000 rewrites the homepage of the site with this slug and raises when it is missing.
// handle_new_user derives a site slug from the first twelve hex digits of the user id, so creating
// this account before the migrations replay reproduces the hosted fixture faithfully.
export const fixtureOwnerId = "b562e3a7-fd91-4000-8000-000000000001";
export const fixtureSiteSlug = "site-b562e3a7fd91";

export type Role = "anon" | "authenticated";

export function migrationFiles(): string[] {
  return readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

let template: Promise<File | Blob> | undefined;

async function buildTemplate(): Promise<File | Blob> {
  const db = new PGlite({ extensions: { pgcrypto } });

  await db.exec(readFileSync(resolve(import.meta.dirname, "supabase-bootstrap.sql"), "utf8"));

  for (const [index, file] of migrationFiles().entries()) {
    try {
      await db.exec(readFileSync(resolve(migrationsDirectory, file), "utf8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`Migration ${file} failed: ${message}`);
    }

    // The fixture account signs up right after the initial migration, as on the hosted project,
    // so every later data migration sees its site.
    if (index === 0) {
      await db.query(
        "insert into auth.users (id, email) values ($1, 'fixture-owner@example.test')",
        [fixtureOwnerId],
      );
    }
  }

  const dump = await db.dumpDataDir("none");

  await db.close();

  return dump;
}

/** A fresh database with every repository migration applied. Each call is fully isolated. */
export async function createMigratedDatabase(): Promise<TestDatabase> {
  template ??= buildTemplate();
  const db = new PGlite({ extensions: { pgcrypto }, loadDataDir: await template });

  return new TestDatabase(db);
}

export class TestDatabase {
  constructor(readonly db: PGlite) {}

  /** Creates an auth user, which also fires the scaffold triggers (profile, first site, owner). */
  async createUser(email: string, id: string = crypto.randomUUID()): Promise<string> {
    await this.db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);

    return id;
  }

  /** Runs `work` inside a transaction as an API role, with RLS applied, then rolls back on error. */
  async as<T>(
    userId: string | null,
    work: (tx: Transaction) => Promise<T>,
    role: Role = userId ? "authenticated" : "anon",
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
      await tx.exec(`set local role ${role}`);

      return work(tx);
    });
  }

  /** Superuser access for arranging fixtures and inspecting results. */
  async admin<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
    return (await this.db.query<T>(sql, params)).rows;
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}

/** Resolves to the Postgres error message, or fails the test if `work` succeeds. */
export async function expectDenied(work: () => Promise<unknown>): Promise<string> {
  try {
    await work();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  throw new Error("Expected the database to reject the operation, but it succeeded");
}
