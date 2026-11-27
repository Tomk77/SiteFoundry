import type { TestDatabase } from "./harness";

export type DeliveryBundle = {
  pages: { id: string; path: string; slug: string; parentId: string | null }[];
  contentTypes: { slug: string; records: { id: string }[] }[];
  redirects: { sourcePath: string; destinationPath: string }[];
};

/** Creates a token as the owner and reads the delivery bundle as `anon`, like the API does. */
export async function deliver(
  database: TestDatabase,
  ownerId: string,
  siteId: string,
  siteSlug: string,
): Promise<DeliveryBundle> {
  const created = await database.as(ownerId, (tx) =>
    tx.query<{ created: { token: string } }>(
      "select public.create_site_api_token($1, 'Test', '{}', null) as created",
      [siteId],
    ),
  );
  const token = created.rows[0]?.created.token;
  const result = await database.as(null, (tx) =>
    tx.query<{ bundle: DeliveryBundle }>(
      "select public.get_delivery_bundle($1, encode(sha256(convert_to($2, 'utf8')), 'hex'), null) as bundle",
      [siteSlug, token],
    ),
  );
  const bundle = result.rows[0]?.bundle;

  if (!bundle) throw new Error("No delivery bundle");

  return bundle;
}

export async function publishPage(
  database: TestDatabase,
  userId: string,
  pageId: string,
  slug: string,
) {
  await database.as(userId, (tx) =>
    tx.query(
      `select public.save_page_revision(
         $1, (select concept_revision_id from public.pages where id = $1),
         initcap($2), $2, '[]'::jsonb, '', '', null, null, 'ready', true)`,
      [pageId, slug],
    ),
  );
}
