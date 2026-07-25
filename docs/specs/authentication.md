# Authentication and sessions

- Status: Working specification
- Owner: Unassigned
- Created: 2026-07-22
- Last updated: 2026-07-22

## Delivery-token decisions

- Public delivery requires a site-owned publishable read token on every request.
- Publishable tokens are browser-visible identifiers and are not confidential credentials.
- Raw tokens are generated with cryptographically secure randomness, displayed once, and represented
  in storage only by a SHA-256 hash plus a non-sensitive prefix/suffix.
- Tokens support a name, optional expiry, optional allowed browser origins, last-used tracking,
  immediate revocation, and the fixed `published:read` scope.
- Tokens are validated at the database boundary and are rate-limited per token.
- Future preview tokens are a separate confidential credential type and are not implemented.

Administration sessions continue to use Supabase authentication. Their complete session, provider,
recent-authentication, invitation, and recovery contracts remain unresolved.
