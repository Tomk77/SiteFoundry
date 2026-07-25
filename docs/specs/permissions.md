# Permissions

- Status: Working specification
- Owner: Unassigned
- Created: 2026-07-22
- Last updated: 2026-07-22

## Delivery API scope

- Owners and administrators can create, inspect, and revoke site API tokens.
- Publishable tokens have one fixed capability: `published:read` for their owning site.
- A token can never cross a site boundary, even when another site's key is supplied in the URL.
- Published delivery includes pages, structured content, navigation, redirects, languages, verified
  public domains, and available public media metadata.
- It excludes people, invitations, accounts, credentials, unverified domain state, private preview
  settings, and all draft/concept data.

Fine-grained role/action/resource permissions and preview-token scopes remain unresolved.
