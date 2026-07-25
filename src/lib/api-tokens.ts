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

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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

export async function createSiteApiToken(input: {
  siteId: string;
  name: string;
  allowedOrigins: string;
  expiresAt: string;
}) {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const secret = `scaffold_pub_${base64Url(random)}`;
  const tokenHash = await sha256(secret);
  const allowedOrigins = normalizeAllowedOrigins(input.allowedOrigins);
  const expiresAt = input.expiresAt
    ? new Date(`${input.expiresAt}T23:59:59.999Z`).toISOString()
    : null;
  const { error } = await requireClient()
    .from("site_api_tokens")
    .insert({
      site_id: input.siteId,
      name: input.name.trim(),
      token_hash: tokenHash,
      token_prefix: secret.slice(0, 13),
      token_suffix: secret.slice(-4),
      allowed_origins: allowedOrigins,
      expires_at: expiresAt,
    });
  if (error) throw error;

  return secret;
}

export async function revokeSiteApiToken(tokenId: string) {
  const { error } = await requireClient()
    .from("site_api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId);
  if (error) throw error;
}
