import { getSupabaseBrowserClient, getSupabaseConfigError } from "./supabase";

export type SiteApiToken = {
  id: string;
  name: string;
  displayToken: string;
  scopes: string[];
  allowedOrigins: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

function requireClient() {
  const client = getSupabaseBrowserClient();
  if (!client) throw getSupabaseConfigError();

  return client;
}

export function normalizeAllowedOrigins(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].map((item) => {
    const url = new URL(item);
    if (url.pathname !== "/" || url.search || url.hash) {
      throw new Error(`Use an origin without a path: ${item}`);
    }

    return url.origin;
  });
}

export async function listSiteApiTokens(siteId: string): Promise<SiteApiToken[]> {
  const { data, error } = await requireClient()
    .from("site_api_tokens")
    .select(
      "id, name, token_prefix, token_suffix, scopes, allowed_origins, expires_at, last_used_at, revoked_at, created_at",
    )
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return data.map((token) => ({
    id: token.id,
    name: token.name,
    displayToken: `${token.token_prefix}••••${token.token_suffix}`,
    scopes: token.scopes,
    allowedOrigins: token.allowed_origins,
    expiresAt: token.expires_at,
    lastUsedAt: token.last_used_at,
    revokedAt: token.revoked_at,
    createdAt: token.created_at,
  }));
}

// The database generates the secret, stores only its SHA-256 hash and returns the secret once.
export async function createSiteApiToken(input: {
  siteId: string;
  name: string;
  allowedOrigins: string;
  expiresAt: string;
}) {
  const allowedOrigins = normalizeAllowedOrigins(input.allowedOrigins);
  const expiresAt = input.expiresAt
    ? new Date(`${input.expiresAt}T23:59:59.999Z`).toISOString()
    : null;
  const { data, error } = await requireClient().rpc("create_site_api_token", {
    target_site_id: input.siteId,
    target_name: input.name.trim(),
    target_allowed_origins: allowedOrigins,
    target_expires_at: expiresAt ?? undefined,
  });
  if (error) throw error;
  const token = data && typeof data === "object" && !Array.isArray(data) ? data.token : null;
  if (typeof token !== "string" || !token) throw new Error("The database did not return a token.");

  return token;
}

export async function revokeSiteApiToken(tokenId: string) {
  const { error } = await requireClient().rpc("revoke_site_api_token", {
    target_token_id: tokenId,
  });
  if (error) throw error;
}
