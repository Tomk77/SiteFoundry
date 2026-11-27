#!/usr/bin/env node
// Replays supabase/migrations into the LOCAL Supabase stack started with `pnpm db:start`.
// It refuses to run against anything but 127.0.0.1/localhost. See docs/SETUP.md and ADR 0005.
//
// Order matters: the fixture account signs up right after the first migration, exactly as on the
// hosted project, so 20260728152000 finds site `site-b562e3a7fd91` (review finding 4.1). The
// fixture account doubles as the local development login.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migrationsDirectory = resolve(root, "supabase/migrations");
const supabase = ["exec", "supabase"];
const container = "supabase_db_scaffold-cms";

const fixture = {
  id: "b562e3a7-fd91-4000-8000-000000000001",
  email: process.env.LOCAL_DEV_EMAIL ?? "dev@scaffold.local",
  password: process.env.LOCAL_DEV_PASSWORD ?? "scaffold-local-dev",
};

function status() {
  const output = execFileSync("pnpm", [...supabase, "status", "-o", "json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

  return JSON.parse(output.slice(output.indexOf("{")));
}

function psql(sql) {
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      "-1",
    ],
    { input: sql, stdio: ["pipe", "inherit", "inherit"] },
  );
}

async function createFixtureUser(apiUrl, serviceKey) {
  const response = await fetch(`${apiUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      id: fixture.id,
      email: fixture.email,
      password: fixture.password,
      email_confirm: true,
      user_metadata: { full_name: "Local Developer" },
    }),
  });

  if (!response.ok) throw new Error(`Creating the fixture user failed: ${await response.text()}`);
}

const local = status();
const apiUrl = local.API_URL;
const serviceKey = local.SERVICE_ROLE_KEY ?? local.SECRET_KEY;

if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(apiUrl ?? "")) {
  throw new Error(`Refusing to run against a non-local API: ${apiUrl}`);
}

const files = readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();

for (const [index, file] of files.entries()) {
  process.stdout.write(`Applying ${file}\n`);
  psql(readFileSync(resolve(migrationsDirectory, file), "utf8"));

  if (index === 0) await createFixtureUser(apiUrl, serviceKey);
}

// `pnpm dev:local` runs Vite in mode "localdb", which reads this git-ignored file. A hosted
// .env.local stays untouched.
writeFileSync(
  resolve(root, ".env.localdb.local"),
  `VITE_SUPABASE_URL=${apiUrl}\nVITE_SUPABASE_PUBLISHABLE_KEY=${local.PUBLISHABLE_KEY ?? local.ANON_KEY}\n`,
);

process.stdout.write(
  `Done. Run \`pnpm dev:local\` and sign in at http://localhost:4000 as ${fixture.email}.\n`,
);
