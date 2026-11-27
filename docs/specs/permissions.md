# Permissions

- Status: Working specification
- Owner: Unassigned
- Created: 2026-07-22
- Last updated: 2026-11-27

## Delivery API scope

- Owners and administrators can create, inspect, and revoke site API tokens.
- Publishable tokens have one fixed capability: `published:read` for their owning site.
- A token can never cross a site boundary, even when another site's key is supplied in the URL.
- Published delivery includes pages, structured content, navigation, redirects, languages, verified
  public domains, and available public media metadata.
- It excludes people, invitations, accounts, credentials, unverified domain state, private preview
  settings, and all draft/concept data.

## Administration access (enforced in the database)

The role presets, access scopes and product sections come from the approved Site Settings design
([Site settings UI](site-settings-ui.md), sections 4, 9.6 and 9.7). Since 2026-11-27 the database
enforces them in migration `20261127120000_access_control.sql`, tested in `tests/database/`.

Roles:

| Capability                                   | Owner | Administrator     | Publisher | Editor | Viewer |
| -------------------------------------------- | ----- | ----------------- | --------- | ------ | ------ |
| Read content in scope                        | Yes   | Yes               | Yes       | Yes    | Yes    |
| Create, edit, move, delete content in scope  | Yes   | Yes               | Yes       | Yes    | No     |
| Publish pages and structured records         | Yes   | Yes               | Yes       | No     | No     |
| Manage settings, languages, domains, tokens  | Yes   | Yes               | No        | No     | No     |
| Change member access                         | Yes   | Yes, except owner | No        | No     | No     |
| Transfer ownership, delete the site          | Yes   | No                | No        | No     | No     |

Rules:

- Owners and administrators always have full-site access. Access scope and sections only restrict
  publishers, editors and viewers. An administrator could widen their own scope anyway.
- **Full site** covers every language. **Selected languages** covers every page and language-level
  resource in the chosen languages. **Selected branches** covers the chosen pages and all their
  descendants, including future ones.
- Branch-scoped members can read the whole language tree that contains one of their branches (they
  need ancestors to navigate). They cannot edit language-level resources (redirects, navigation,
  footer, structured content, templates), because no scope rule defines branch ownership for them.
- Product sections gate writes: `pages` (pages and page functions), `redirects`, `navigation`
  (header menu), `footer` (footer menu), `structured` (content types, fields, records), `templates`
  (page templates). `media` has no persisted data yet. Sections do not restrict reads.
- Publishing a page (`publish_page`, `save_page_revision` with publish), creating or keeping a
  structured record in `published` status, and `publish_content_type_schema` need the publish
  capability. Because editing a published record republishes it, editors cannot edit published
  records until records get a separate concept stage (WP2, finding 2.1).
- Publishing a header or footer menu (changing `published_items` or `published_at`) needs the
  publish capability; saving draft items needs only edit access for the `navigation` or `footer`
  section (migration `20261127130000_navigation_publish_permission.sql`).
- Editors may delete content in their scope, including published pages and records.
- Moving a page needs edit access to the page and to its new parent. Redirects created by a move do
  not need the `redirects` section.
- `sites.owner_id` and the single `owner` membership always agree (checked at commit). Ownership
  changes only through `transfer_site_ownership`.
- Memberships change only through `update_site_member_access` (and removal). There is no direct
  insert, so inviting someone does not grant access until an invitation-accept flow exists.
- Sites are created only by the signup trigger, together with their owner membership.
- API tokens are generated, hashed and revoked by `create_site_api_token` and
  `revoke_site_api_token`; the browser never supplies a hash and cannot edit token rows.
- Tree position, URL, lifecycle and revision pointers of pages (`parent_id`, `slug`, `status`,
  `site_language_id`, `is_homepage`, `published_revision_id`, `concept_revision_id`) and a record's
  `published_revision_id` change only through the database functions. Revision pointers must refer to
  a revision of the same page or record.

## Decisions (2026-11-27)

| Question | Decision |
| --- | --- |
| Does a branch-scoped member see the whole language tree? | Yes. Already enforced. |
| Can branch-scoped members manage redirects, menus, structured content or templates? | Deferred. Denied until defined. |
| Can editors delete published content? | Yes. Already enforced. |
| Is publishing a menu a publish permission? | Yes. Enforced by `20261127130000`. |
| Can editors publish? | No. Only owners, administrators and publishers publish. Already enforced. |

## Planned: invitation acceptance (to do)

Intended direction, not yet specified or implemented:

- Invitees from the same workspace are added to the site automatically.
- Other invitees accept by signing in with SSO or by registering a new account.

Open before this can be specified: what "workspace" means in Scaffold (there is no workspace entity
today; sites are the only tenant), how SSO providers are configured, how the invitee's email is
verified before membership is granted, and what happens to pending invitations for an account that
already exists. Until then invitations stay pending and grant no access.

## Open questions

- Should sections also restrict reads, and should viewers have sections at all (Site Settings UI
  open question)?
- Is changing a page template's status to `published` a publish capability?

Preview-token scopes remain unresolved.
