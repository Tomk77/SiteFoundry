# Authentication and sessions

- Status: Working specification
- Owner: Unassigned
- Created: 2026-07-22
- Last updated: 2026-11-27

## Delivery-token decisions

- Public delivery requires a site-owned publishable read token on every request.
- Publishable tokens are browser-visible identifiers and are not confidential credentials.
- Raw tokens are generated in the database (`create_site_api_token`, 256 random bits from pgcrypto),
  displayed once, and represented in storage only by a SHA-256 hash plus a non-sensitive
  prefix/suffix. The browser never supplies a hash, and token rows cannot be edited directly;
  revocation goes through `revoke_site_api_token`.
- Tokens support a name, optional expiry, optional allowed browser origins, last-used tracking,
  immediate revocation, and the fixed `published:read` scope.
- Tokens are validated at the database boundary and are rate-limited per token.
- Future preview tokens are a separate confidential credential type and are not implemented.

Administration sessions continue to use Supabase authentication. Their complete session, provider,
recent-authentication, invitation, and recovery contracts remain unresolved.
