# Site settings UI design specification

- Status: Working specification
- Owner: Unassigned
- Created: 2026-07-21
- Last updated: 2026-07-25
- Related specifications: Personal settings, permissions, authentication and sessions, sites and languages, admin information architecture

## Implementation status

The administration proof of concept is implemented at `/settings`. It includes six settings
destinations, URL-restorable destination and People tab state, general settings editing, member search
and role filtering, invitations, scoped member access, the role matrix, languages, domains and preview
configuration, export requests, ownership transfer, and guarded deletion. Desktop and narrow-screen
presentations share the existing Scaffold CMS shell and Tailwind semantic tokens.

The interface now loads and mutates site-scoped data through Supabase. Migration
`20260721213000_site_settings.sql` adds the persistence model, row-level security, protected ownership
and default-selection functions, and a capability-shaped settings workspace query. Owners and
administrators can manage settings and people; other roles receive a conservative read-only view of
their own access while the formal authentication and permissions specifications remain unresolved.

Invitations are persisted but are not delivered or accepted yet. Domain verification records an
explicit pending request but has no DNS worker. Export requests are queued but have no export worker or
download artifact. Those asynchronous workflows, invitation tokens, concurrent-change handling, and
the final permission evaluation contract remain follow-up work rather than simulated success states.

## Instructions for the design agent

Use this document as the complete product brief for designing Scaffold CMS's Site Settings interface.
Produce UI designs only. Do not define database tables, API endpoints, invitation tokens, authorization
algorithms, or implementation architecture.

The designs must extend the existing Scaffold CMS administration application rather than introduce a
new visual system. Preserve the existing application shell, typography, semantic colors, compact
control sizing, rounded surfaces, subtle borders, and restrained editor-focused character.

Design the following primary deliverables:

1. General settings at desktop width.
2. People & access member list at desktop width.
3. Invite person dialog.
4. Member access detail drawer.
5. Roles and permissions comparison.
6. Languages settings.
7. Domains & preview settings.
8. API access and publishable-token management.
9. Advanced settings and danger zone.
10. People & access at mobile width.
11. Loading, empty, read-only, validation, and destructive-confirmation states where specified.

Use 1440 × 900 as the primary desktop frame and 390 × 844 as the primary mobile frame. Include
annotations for behavior that cannot be communicated by a static frame.

## 1. Summary

Site Settings lets an authorized user understand and configure one selected website. It is distinct
from Personal Settings, which belongs to the signed-in account across every website.

The experience covers:

- website identity and regional defaults;
- current people with access;
- pending invitations;
- role presets and member access scope;
- website languages;
- production and preview domains;
- publishable delivery API tokens;
- ownership transfer, export, and deletion.

The most important design outcome is confidence: a site owner must be able to answer who has access,
what each person can do, and where that access applies without interpreting an abstract permission
system.

## 2. Goals

- Make the active website unmistakable throughout Site Settings.
- Show every active member and pending invitation in one predictable place.
- Explain roles in plain language before a user assigns them.
- Make full-site, selected-language, and selected-page-branch access understandable.
- Keep frequent configuration calm and efficient while making dangerous actions deliberate.
- Provide useful read-only views to users who can inspect settings but cannot change them.
- Scale from a single-owner website to an agency website with dozens of members and languages.
- Remain usable with keyboard navigation and on narrow screens.

## 3. Non-goals

- Personal profile, email, password, theme, or interface-language settings.
- Installation-wide administration across every website.
- Authentication provider setup, single sign-on, passkeys, or multi-factor authentication.
- Designing invitation email messages.
- Defining backend permission evaluation or conflict-resolution algorithms.
- Webhooks, plugins, billing, plans, or usage metering. Publishable delivery-token management is now
  implemented as a dedicated API access destination.
- A custom role builder in the initial UI. The initial design uses five role presets.
- Approval workflows, scheduled publishing, or multi-stage editorial review.

## 4. Users and visibility

The UI uses capability-driven behavior. Never rely only on hiding a button; however, the design should
avoid presenting actions that the current user cannot perform.

### Owner

- Can see and change every setting.
- Can invite, edit, and remove people.
- Can transfer ownership, export, and delete the website.
- Is always shown with an Owner badge.
- Cannot remove or demote themselves through ordinary member actions.

### Administrator

- Can manage general settings, languages, domains, and people.
- Cannot transfer ownership or delete the website.
- Cannot remove or demote the owner.

### Publisher

- Can work with and publish content inside their assigned scope.
- Can view their own access summary.
- Sees Site Settings as read-only unless separately granted a settings capability.

### Editor

- Can create and edit content inside their assigned scope but cannot publish.
- Can view their own access summary.
- Sees Site Settings as read-only unless separately granted a settings capability.

### Viewer

- Has read-only access inside their assigned scope.
- Can view their own access summary.
- Does not see membership details for unrelated people unless granted user-management visibility.

## 5. Terminology

- **Active website:** The website selected in the application shell.
- **Member:** An account that currently has access to the active website.
- **Invitation:** Pending access offered to an email address that has not yet been accepted.
- **Role preset:** Owner, Administrator, Publisher, Editor, or Viewer.
- **Access scope:** The website resources to which a role applies.
- **Full site:** Every current and future language and page branch in the website.
- **Selected languages:** Every section and page within one or more chosen languages.
- **Selected branches:** One or more chosen page-tree branches, including future descendants.
- **Section access:** Access to product areas such as Pages, Media, Redirects, Navigation, Structured content, and Page templates.
- **Current user:** The signed-in person, marked with a “You” label.

## 6. Information architecture

Site Settings remains inside the existing application shell. Selecting Settings in the primary left
navigation opens a settings workspace for the active website.

Within that workspace, use a secondary settings navigation with these destinations:

1. **General**
2. **People & access**
3. **Languages**
4. **Domains & preview**
5. **API access**
6. **Advanced**

People & access contains three local tabs:

- **Members** with a count;
- **Invitations** with a pending count;
- **Roles & permissions**.

The secondary destination and People & access tab should be linkable and restorable after reload.
Switching destination must not change the active website.

## 7. Shared page composition

### 7.1 Site Settings header

The top of every destination contains:

- eyebrow: “Website configuration” with a gear icon;
- heading: “Site settings”;
- active website name and optional icon;
- supporting copy: “Settings for {site name}.”;
- an access badge when helpful, such as “Owner” or “Read only”.

The header should include a compact active-website control only if the existing application shell does
not make the website sufficiently obvious. Do not add a second competing website selector.

### 7.2 Secondary navigation

On desktop, use a narrow vertical settings navigation to the left of the content pane. Each item has an
icon, label, and selected state. People & access may show a small pending-invitation count.

On mobile, replace the vertical navigation with a full-width destination selector below the page
header. The selected destination remains visible while scrolling.

### 7.3 Content pane

- Recommended desktop content width: 760–900 px for forms and up to 1080 px for member tables.
- Use clear section cards rather than one uninterrupted form.
- Each card has a title, concise explanation, and controls.
- Avoid dashboard-style metric cards unless the value supports a concrete action.
- Primary save actions appear in a persistent bottom action bar only while there are unsaved changes.
- Discard and Save actions must identify which destination they affect.

### 7.4 Feedback

- Successful saves use a concise toast and update the saved state in place.
- Field errors appear next to the field and in a short page-level summary when several fields fail.
- Destructive results and invitation results must not rely on transient toast messages alone.
- Operations that take noticeable time show progress on the initiating control.

## 8. General settings

### 8.1 Website identity card

Fields:

- Website name — required text field.
- Internal identifier — stable slug/key, shown in a monospace field.
- Website icon — optional square image or generated initials.

Behavior:

- Explain that the internal identifier is used by integrations and should rarely change.
- Editing the identifier reveals an inline warning before save.
- Icon actions are Replace and Remove; a generated fallback remains visible when no image exists.

### 8.2 Regional defaults card

Fields:

- Default content language.
- Time zone.
- Date and time preview using the selected time zone.

The default-language control links conceptually to Languages. If only one language exists, still show
the value and offer “Manage languages”.

### 8.3 Appearance preview card

Show how the website is represented in Scaffold CMS's website selector:

- icon or initials;
- website name;
- active language name and code.

This is an administration preview, not a website theme editor.

### 8.4 Read-only state

Users without permission see the same information as text or disabled controls, a “Read only” badge,
and the explanation “You can view these settings, but an owner or administrator must change them.”

## 9. People & access

### 9.1 Section header

Include:

- heading: “People & access”;
- description: “Manage who can work on {site name} and where their access applies.”;
- primary action: “Invite person”;
- search input;
- optional filters for Role, Status, Language, and Access scope.

The Invite person action is hidden or disabled with an explanation for unauthorized users.

### 9.2 Members tab

Desktop uses a table with these columns:

1. **Person** — avatar or initials, display name, email, and “You” where applicable.
2. **Role** — role badge and short description.
3. **Access** — human-readable scope summary.
4. **Last active** — relative time with exact timestamp available on hover/focus.
5. **Actions** — overflow menu.

Example access summaries:

- “Full site”
- “English and Dutch”
- “English · Blog branch”
- “Pages, Media · English”
- “3 languages · 2 page branches”

Rows are selectable and open the member access drawer. The overflow menu contains only actions valid
for that member and current user.

Owner row rules:

- Owner badge is visually distinct but not alarming.
- Role and access show “Full site”.
- Ordinary Change role and Remove actions are absent.
- Transfer ownership is available only from Advanced or an explicit owner action.

Current user row rules:

- Add a quiet “You” label after the name.
- Self-removal and self-demotion are never one-click actions.

Mobile replaces each table row with a card containing Person, Role, Access, Last active, and a single
overflow action. Search and filters remain above the list.

### 9.3 Member row actions

Possible actions:

- View access
- Change role and access
- Copy email address
- Remove from website

Changing role/access opens the member drawer. Removing a member opens a confirmation dialog that
states what access will end. Do not imply that removing website access deletes the account or authored
content.

Confirmation copy:

- Title: “Remove {name} from {site name}?”
- Body: “They will lose access to this website. Their account and existing content history will remain.”
- Confirm action: “Remove access”

### 9.4 Invitations tab

Use a table or card list with:

- invited email;
- proposed role;
- proposed access summary;
- invited by;
- sent date;
- expiry or status;
- actions.

Statuses:

- Pending
- Expiring soon
- Expired
- Revoked

Actions:

- Copy invitation link, when allowed
- Resend invitation
- Edit proposed access
- Revoke invitation

Empty-state copy:

- Title: “No pending invitations”
- Body: “Invite someone when they need access to this website.”
- Action: “Invite person”

### 9.5 Invite person dialog

Use a focused modal at desktop width and a full-screen sheet on mobile.

Fields and order:

1. Email address — required.
2. Role preset — required, shown as selectable role cards or a select plus contextual description.
3. Access scope — Full site, Selected languages, or Selected page branches.
4. Language selection — shown only when required by scope.
5. Page branch selection — shown only for Selected page branches.
6. Section access — shown for Publisher, Editor, and Viewer.
7. Optional personal message — collapsed by default.

Role cards show the role name and one-sentence outcome:

- Administrator — “Manage this website, its settings, and its people.”
- Publisher — “Create, edit, and publish content in the assigned scope.”
- Editor — “Create and edit content without publishing.”
- Viewer — “View content and configuration without making changes.”

Owner is not available in the invitation dialog. Ownership uses a separate transfer flow.

The bottom of the dialog contains a live summary, for example:

> Jamie will be able to edit Pages and Media in English and Dutch, but cannot publish or manage settings.

Actions:

- Cancel
- Send invitation

Success state remains visible long enough to confirm the email, role, and scope, with actions to Invite
another person or Done.

### 9.6 Member access drawer

Open a right-side drawer on desktop and a full-screen sheet on mobile. Preserve list position when it
closes.

Header:

- avatar/initials;
- name and email;
- member status;
- current role;
- last active.

Editable sections:

1. Role preset.
2. Access scope.
3. Languages.
4. Page branches.
5. Product sections.

Product section choices:

- Pages
- Media
- Redirects
- Header navigation
- Footer
- Structured content
- Page templates

Settings and People access derive from Administrator/Owner and are not ordinary section toggles in the
initial UI.

Show a sticky summary above the drawer actions. Example:

> Editor · English · Blog and News branches · Pages and Media

Actions:

- Cancel
- Save access

Changing someone from Administrator to a narrower role requires confirmation because access will be
lost. The confirmation lists the most important removed capabilities.

### 9.7 Roles & permissions tab

This tab explains the five presets. It does not create custom roles.

Use one of these layouts:

- role cards followed by a capability comparison table; or
- a fixed first column with horizontally scrollable role columns on narrow screens.

Capability groups:

- Content: view, create, edit, move/reorder, delete, publish.
- Media: view, upload/edit, delete.
- Website structures: redirects, header navigation, footer.
- Structured content and templates.
- Website settings.
- People and access.
- Ownership and website deletion.

Use check icons plus short text where a simple check could be misleading. Add the note:

> A person's role controls what they can do. Their access scope controls where they can do it.

The initial preset matrix is:

| Capability | Owner | Administrator | Publisher | Editor | Viewer |
| --- | --- | --- | --- | --- | --- |
| View assigned content | Yes | Yes | Yes | Yes | Yes |
| Create and edit content | Yes | Yes | Yes | Yes | No |
| Move and reorder pages | Yes | Yes | Yes | Yes | No |
| Delete content | Yes | Yes | Yes | Limited to assigned scope | No |
| Publish content | Yes | Yes | Yes | No | No |
| Manage languages/domains | Yes | Yes | No | No | No |
| Manage people | Yes | Yes, except owner | No | No | No |
| Transfer ownership/delete site | Yes | No | No | No | No |

## 10. Languages

### 10.1 Language list

Each language row/card contains:

- language name;
- locale code;
- default badge where applicable;
- URL prefix preview;
- page count;
- access warning if no administrator can manage it;
- actions.

Actions:

- Edit language
- Set as default
- Reorder
- Remove

The default language cannot be removed. A language with content opens a confirmation that explains the
content impact and does not offer a casual destructive action.

### 10.2 Add language dialog

Fields:

- Language/locale searchable selector.
- Display name.
- Locale code.
- URL strategy preview.
- Copy defaults from an existing language, optional.

Show a concise preview such as:

> English: example.com/about
> Dutch: example.com/nl/over-ons

Do not imply that adding a language automatically translates content or duplicates the full tree.

### 10.3 Empty and single-language states

A website must always have at least one language. For a single-language site, show the language normally
and explain that additional independent language trees can be added.

## 11. Domains & preview

### 11.1 Production domain card

Show:

- primary production domain;
- verification status;
- canonical URL preview;
- actions to Add, Verify, Make primary, or Remove.

Statuses:

- Verified
- Verification pending
- Misconfigured
- Not connected

Domain rows should make the primary domain and current problem unmistakable without relying on color.

### 11.2 Preview environment card

Fields:

- Preview website URL.
- Optional path pattern or example preview URL.

Show a preview such as:

> https://preview.example.com/about?sc-preview=…

Do not display real secrets or complete preview tokens in designs.

### 11.3 URL behavior card

Summarize how language prefixes and canonical URLs combine. Link to Languages for changes that belong
there rather than duplicating controls.

## 12. API access

API access lists site-owned publishable read tokens and lets owners and administrators create and
revoke them. Creation collects a recognizable name, optional expiration date, and optional allowed
browser origins. The complete token is shown once with an explicit copy action. Existing rows show a
masked identifier, status, creation time, last-used time, expiration, and origin summary.

The screen must explain that publishable tokens can appear in browser code and never grant draft or
administration access. Revocation requires deliberate confirmation and takes effect immediately.

API access also includes a site-scoped GraphQL playground. It uses the site's fixed versioned endpoint,
accepts a publishable token, and embeds Apollo Sandbox for schema browsing, autocomplete, query
building, variables, headers, and response inspection. It does not persist the token or place it in the
URL. A token shown immediately after creation is filled in and connected for the current page session.
An external Apollo Sandbox link preconfigures the endpoint and sample query but deliberately omits the
token.

## 13. Advanced

### 12.1 Ownership

Show current owner with name and email. The Transfer ownership action opens a guarded flow:

1. Choose an existing Administrator.
2. Explain that the current owner will become an Administrator.
3. Require confirmation using the website name.
4. Use the final action label “Transfer ownership”.

Do not combine ownership transfer with ordinary role editing.

### 12.2 Export

Show “Export website data” as a neutral advanced action with a short explanation of what the export is
expected to include. The design needs ready, preparing, completed, and failed states, but not export
format details.

### 12.3 Danger zone

Place destructive actions in a visually separated section at the bottom.

Delete website flow:

- State that the website, language trees, content, media references, navigation, redirects, and settings
  will become unavailable.
- Do not claim behavior for external media objects or consuming websites unless separately defined.
- Require typing the website name exactly.
- Final action: “Delete website”.
- Disable the final action until confirmation matches.

The danger zone should communicate seriousness through hierarchy, copy, spacing, and confirmation—not
through an excessively red page.

## 13. Shared states

### Loading

- Preserve the settings shell and navigation.
- Use skeletons matching the destination's final shape.
- Avoid a full-screen spinner after the application shell is visible.

### Initial load failure

- Show a focused error state in the content pane.
- Preserve the active website and destination.
- Provide Retry and Back to Pages actions.

### Empty members search

- Copy: “No people match these filters.”
- Action: Clear filters.

### Empty invitations

- Use the Invitations empty state defined above.

### Read-only

- Keep useful information visible.
- Replace editable actions with a Read only badge and one concise explanation.
- Do not render dozens of disabled controls when formatted values are clearer.

### Unsaved changes

- Show a persistent bottom action bar inside the settings content area.
- Actions: Discard changes and Save changes.
- Navigating to another destination prompts to discard or continue editing.

### Concurrent change

- If the viewed member or setting changed elsewhere, show a non-destructive banner.
- Actions: Review latest and Keep editing, when safe.

### Permission changed

- If the current user's access changes while the screen is open, replace unauthorized editing controls
  with a clear explanation and preserve any safe unsaved text for copying.

## 14. Validation and error presentation

- Required fields show errors after blur or attempted submission, not immediately on first focus.
- Email errors distinguish invalid format, already a member, and already invited.
- Role and scope errors identify the missing decision.
- Page-branch selection must identify the language of each branch.
- Domain errors should state the failed check and next corrective action.
- Destructive confirmations explain consequences before the confirmation field.
- Failed operations preserve non-sensitive form input.
- Focus moves to the first invalid field or error summary after a rejected submission.

## 15. Responsive behavior

### Desktop, 1200 px and wider

- Existing application shell remains visible.
- Vertical settings navigation and content pane appear side by side.
- Member list uses a table.
- Member access uses a right-side drawer around 440–520 px wide.

### Tablet, 760–1199 px

- Application shell may use its existing compact behavior.
- Settings navigation narrows or becomes a horizontal/selector treatment.
- Lower-priority member data moves into the row's secondary line.
- Drawers may occupy most of the viewport width.

### Mobile, below 760 px

- Settings destination selector is full width below the header.
- Member table becomes cards.
- Dialogs and drawers become full-screen sheets.
- Sticky bottom actions respect safe-area insets.
- Permission comparison may scroll horizontally, but role names remain visible.
- No essential action depends on hover.

## 16. Accessibility

- Use semantic headings and landmarks for the settings navigation and content.
- Every settings destination and People & access tab is keyboard reachable.
- Selected navigation and tab states are programmatically exposed.
- Member rows must not hide their only action inside a pointer-only target.
- Drawers and dialogs trap focus and restore it to the initiating control.
- Statuses include text or accessible labels, not color alone.
- Role descriptions are associated with role controls.
- Permission matrices have meaningful row and column headers.
- Reordering languages has keyboard alternatives.
- Toasts, inline errors, saves, invitations, and destructive results are announced.
- Target WCAG 2.2 AA contrast and interaction behavior.

## 17. Design language

- Follow the existing Scaffold CMS light and dark themes.
- Use Geist for interface text and Geist Mono for identifiers, locale codes, and technical URLs.
- Prefer compact 32–38 px controls consistent with the administration UI.
- Use semantic Scaffold CMS surfaces: canvas, surface, sunken, border, selection, action, published,
  concept, danger, and muted text.
- Cards use restrained borders and shadows; avoid floating glass effects or decorative gradients.
- Purple/blue action color identifies selection and primary actions.
- Green identifies verified or successful states.
- Amber identifies pending or expiring states.
- Red is reserved for errors and destructive confirmation.
- Maintain generous spacing between settings groups even though individual controls remain compact.

## 18. Mock content for designs

Use fictional data so every important state is visible.

Website:

- Name: Northstar Journal
- Internal identifier: northstar-journal
- Default language: English
- Other languages: Dutch and German
- Time zone: Europe/Amsterdam
- Production domain: northstar.example
- Preview URL: preview.northstar.example

Members:

| Name | Email | Role | Access | Status |
| --- | --- | --- | --- | --- |
| Alex Morgan | alex@northstar.example | Owner | Full site | Active · You |
| Mara Jensen | mara@northstar.example | Administrator | Full site | Active |
| Liam Chen | liam@northstar.example | Publisher | English and Dutch | Active |
| Amina Yusuf | amina@agency.example | Editor | English · Blog branch | Active |
| Sofia Rossi | sofia@agency.example | Viewer | German · Pages and Media | Active |

Invitations:

| Email | Role | Access | Status |
| --- | --- | --- | --- |
| editor@partner.example | Editor | Dutch · Pages | Pending |
| reviewer@client.example | Viewer | Full site | Expiring soon |

## 19. Required prototype flows

The design handoff should demonstrate these flows:

1. Open Settings and confirm the active website.
2. Move from General to People & access.
3. Search for a member and open their access drawer.
4. Change an Editor from one branch to two branches and save.
5. Invite a Publisher to English and Dutch, then show the success state.
6. View and revoke a pending invitation.
7. Compare Editor and Publisher capabilities.
8. Add a language and preview its URL behavior.
9. Inspect a misconfigured domain.
10. Begin—but do not accidentally complete—ownership transfer and website deletion.

## 20. UI acceptance criteria

1. A viewer can identify the active website and current settings destination without relying on browser URL.
2. A site owner can find every active member and pending invitation.
3. Every member row communicates person, role, scope, and status.
4. The difference between role and access scope is explained in plain language.
5. An invitation can be configured without exposing Owner as an ordinary role choice.
6. The invitation dialog provides a human-readable summary before sending.
7. The owner cannot be casually demoted or removed.
8. Editor and Publisher are visibly different because only Publisher can publish.
9. Full-site, selected-language, and selected-branch scopes have distinct, understandable controls.
10. Unauthorized users receive a useful read-only view rather than a broken form.
11. General, People & access, Languages, Domains & preview, API access, and Advanced are usable at desktop and mobile widths.
12. Loading, empty, error, pending, expired, read-only, and unsaved states are represented.
13. Ownership transfer and deletion require deliberate, clearly labeled confirmation.
14. Personal account settings are never mixed into Site Settings.
15. Designs use the existing Scaffold CMS visual system rather than inventing an unrelated dashboard.

## 21. Deferred UI work

- Creating and editing custom roles.
- Installation-wide user management.
- Bulk member import or bulk role changes.
- Group or directory synchronization.
- Single sign-on and authentication-provider settings.
- Session/device management.
- Webhooks, plugins, billing, and usage. API access now manages publishable delivery tokens.
- Editorial approval workflows.
- Audit-log browsing; changes may later expose an Activity destination.

## 22. Open UI questions

- Should a read-only user see the full member directory or only their own access summary?
- Should Administrators be allowed to invite other Administrators, or only lower roles?
- Should delete permission for Editors include published content, concepts only, or neither?
- Should section access be available for Publishers and Editors only, or for Viewers as well?
- Should domain management stay in Site Settings or later move into a deployment/integrations area?
- Does a website icon use image upload in the first release, or initials only?

These questions should be surfaced as annotated alternatives rather than silently resolved by visual
design. The permissions and authentication specifications will make the final product decisions.

## 23. Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-07-21 | Site Settings is site-scoped and separate from Personal Settings. | Account preferences must follow a person, while these settings belong to one website. |
| 2026-07-21 | The initial settings IA uses General, People & access, Languages, Domains & preview, and Advanced. | This keeps frequent configuration discoverable and isolates destructive actions. |
| 2026-07-21 | The initial design uses five role presets and does not include a custom role builder. | Users need understandable access management before a fully configurable permission system. |
| 2026-07-21 | Role defines what a person can do; access scope defines where they can do it. | Separating capability from resource scope makes permission summaries comprehensible. |
| 2026-07-21 | Owner transfer is separate from ordinary member editing. | Ownership is a protected site-lifecycle operation. |
| 2026-07-21 | The first implementation is an interactive in-memory proof of concept. | The approved interface can be evaluated without inventing unresolved persistence and authorization contracts. |
| 2026-07-21 | Site Settings now persists its synchronous settings and access-management operations in Supabase. | The UI needs real account, role, language, domain, and lifecycle data; RLS and guarded database functions keep sensitive mutations server-authorized. |
| 2026-07-21 | Invitation delivery, DNS verification, and export generation remain queued backend workflows. | Persisting a request is truthful and testable without pretending that an unavailable worker completed external work. |
| 2026-07-22 | API access is a dedicated Site Settings destination for site-owned publishable delivery tokens. | Website builds and browser clients need revocable credentials without confusing them with personal access or future confidential preview tokens. |
