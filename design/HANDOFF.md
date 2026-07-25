# Scaffold CMS admin — design handoff

Session output: interactive design prototypes built as Design Components (`*.dc.html`), inline-styled, with Phosphor icons, Geist / Geist Mono, and the approved Scaffold Amethyst and Fired Clay palette. Each is a clickable spec — open it and interact; every state below is reachable in the prototype.

**Intended real stack:** headless primitives (Radix Primitives or React Aria) styled with the Amethyst/Clay tokens on the TanStack Start / React + Supabase codebase. The prototypes are HTML for review only — do not ship them; rebuild in the app stack using the tokens in `CLAUDE.md`.

**Global conventions (apply to all screens)**
- Palette, type, radii, icon set: see `CLAUDE.md`. Dark-mode token set is documented there too.
- Status is never color alone — always a dot + label. Green is reserved for "Published"; clay is brand-only, never status.
- Every mutating action shows optimistic feedback + a toast; destructive actions confirm first.
- Autosave language ("All changes saved" / "Saving…") is illustrative — wire to real persistence.

---

## 1. Redirects — `Redirects.dc.html`

Management screen for the `redirects` table. Reached from the **Redirects** item in the left nav (currently a placeholder route).

**Data model** (existing `redirects` table): `id`, `site_language_id`, `page_id` (nullable — set when auto-created from a page, null when manual), `source_path`, `destination_path`, `created_at`. Redirects are language-scoped.

**Origin** is derived, not stored as an enum: `page_id != null` → **Automatic** (created by a page move / slug change / delete); `page_id == null` → **Manual**. The UI shows the triggering page + reason for automatic ones.

**Layout:** dense table — Source → Destination, Type, Origin, Added, row actions. Header + body share one scroll container with `min-width:900px` so columns stay aligned and the table scrolls horizontally on narrow panes.

**Features / states**
- Segmented filter: All / Automatic / Manual / **Needs attention** (count badge). When "All", rows are grouped into Manual and Automatic sections.
- Search over source + destination.
- **Health warnings** (computed client-side against the set of live page paths + the redirect graph): `broken` (destination is not a live page), `chained` (destination is itself a redirect source), `loop` (destination cycles back). A red attention banner summarizes the count. Broken/loop = danger red; chained = amber.
- Create (manual) with source/destination validation + live-page detection; edit; delete with confirm. Toasts on each.
- Empty states differ per context (no redirects / no matches / nothing needs attention).

**Proposal beyond current schema:** a **redirect type** selector — `301 Permanent` / `302 Temporary` — shown per row and in the create/edit modal. The `redirects` table has no type column today; add a `status_code` (or `type`) column if you want this real. Everything else maps to existing columns.

**Tweaks (design options, not runtime prefs):** `groupByOrigin` (bool), `density` (comfortable/compact), `defaultType` (301/302).

---

## 2. Header navigation — `Header Navigation.dc.html`

Editor for the site's primary header menu. Reached from the **Header navigation** left-nav item. Uses the **Page Editor layout**: live preview on the left (device toggle), builder panel (404px) on the right.

**Menu model** (ordered tree, one level of nesting):
```
item: { id, kind: 'link'|'group'|'button', label, target, targetType: 'page'|'url', newTab, children[] }
```
- `link` — page link or custom URL (`targetType`).
- `group` — a dropdown; `children` are links.
- `button` — a CTA (styled button), links like a link.
- Only groups nest; children are always links.

**Builder (right panel):** reorderable cards (drag handle + up/down), expand to edit inline — Label, "Links to" (Page select / Custom URL), open-in-new-tab, and for groups a nested, reorderable child-link editor. Add-item menu: Page link / Custom URL / Dropdown / Button. Broken-target warning when a page link points at a non-existent page.

**Preview (left):** device toggle Desktop / Tablet / Mobile (`100%` / `800px` / `390px`), URL pill, refresh. Desktop/Tablet render the horizontal header with a working dropdown strip; Mobile renders a hamburger + drawer with accordion groups. Selection is linked both ways — clicking a link in the preview selects it in the builder and vice-versa; opening a group opens its dropdown. The desktop nav sits in an `overflow-x:auto` track with auto-margins so it right-aligns when there's room and stays legible (logo + start of nav visible) when cramped.

**States:** Draft / Published status, autosave indicator, broken-link count chip in the top bar, publish confirmation (warns if links still point nowhere).

**Tweaks:** `navAlignment` (start/center/end — desktop nav position), `ctaVariant` (solid/outline).

---

## 3. Footer — `Footer.dc.html`

Near-identical to Header navigation (same layout, builder, model, drag/edit behavior) but the preview renders a **site footer**.

**Model:** same item shape. Here `group` = a **titled link column**; top-level `link`/`url` = standalone/legal links (rendered in the bottom bar); `button` = CTA in the brand block.

**Preview:** brand block (logo, tagline, social icons — decorative/static, avatar+socials not in scope), link columns, divider, bottom bar (© + legal links). Desktop lays columns in a row; Mobile stacks everything. Device toggle as in the header.

**Tweaks:** `footerTheme` (dark/light) — footers commonly invert; `ctaVariant` (solid/outline).

---

## 4. Personal settings — `Personal Settings.dc.html`

Account-scoped settings, per `personal-settings.md` spec. **Distinct from site-wide settings** — a focused full page (no site sidebar), reached from the lower-left user card. Opening/saving must not change the selected website or content language. Target user is always derived from the session, never a client-supplied id.

**Sections**
- **Profile** — First name*, Last name, Email*, Display name. Two columns; required + inline validation (email syntax); per-field "unsaved" dots; email-change shows the "confirm from a link" notice. (PSET-010..017)
- **Change password** — Current / New / Confirm, each with a show/hide control; 10-char policy indicator; match check; **separate** Update button. Provider accounts (set `authMethod: google`) hide the form and show provider guidance instead — never a password form that can't succeed. (PSET-020..027) Never prefill or return password values.
- **Experience** — Interface language select (admin UI language only — does not touch content language); Interface mode System / Light / Dark. Mode **live-themes the whole screen**; System follows `prefers-color-scheme` and reacts to OS changes. (PSET-030..038)

**Saving:** Profile + Experience share one primary Save (disabled when nothing changed or invalid, or while saving); password uses its own action; Discard reverts. Unsaved vs saved is visibly distinct. Success toasts; email save notes the pending confirmation.

**Backing data:** first/last/display-name are profile metadata (`profiles` table — currently only `full_name`; split or add columns as needed). Email + password are owned by the auth provider (Supabase Auth) — use provider operations, not direct profile mutation. Interface language + mode are new account-scoped preferences (add storage; persist across sites/devices; apply theme before authed UI paints — PSET-037).

**Tweaks:** `authMethod` (password/google — drives the password section), `usernameField` (show/hide display name — pending the open question on whether username is needed).

**Open questions carried from the spec** (unresolved, flag for product): does the user card open a menu or navigate directly; is "username" a unique identifier / handle / display name; do interface prefs save immediately or via Save; which languages ship first; email-change confirmation flow; does a password change revoke sessions; configurable password policy.

---

## Also changed this session
- **Left-nav icons** updated in `Page Tree.dc.html` to match `app-shell.tsx` (the codebase source of truth): Media `ph-image`, Redirects `ph-arrow-bend-up-left`, Header navigation `ph-browser`, Footer `ph-layout`, Settings `ph-gear`.
- **Page Editor block icons** (`Page Editor.dc.html`) given colored rounded-square badges to match the navigation builders' item styling.

---

## 5. Structured content - `Structured Content.dc.html`

Structured non-page content uses a two-rail layout: the normal product navigation, a content-type rail, and a record table. The selected type controls the dynamic columns and record editor fields.

**Content type model:** name, singular name, icon, field definitions, and records. Fields support text, long text, rich text, email, phone, URL, number, date, toggle, tags, image, choice, and reference. One field is the primary display field.

**Record workflow:** search and status filters, create, edit in a right-hand drawer, Concept / Published state, field-specific controls, validation of the primary field, delete confirmation, empty states, and success feedback.

**Type workflow:** create and configure a type, choose an icon, add or remove fields, change field types, select the primary field, and delete a custom type. Schema editing is a development-only capability according to `PAGE_TREE_SPEC.md`; production should load deployed schema configuration as read-only.

**URL state:** selected type, query, and status filter are represented in the URL so a filtered record view can be shared and restored.

## Palette update

- Amethyst is the only interactive accent across product screens.
- Selected rows, active navigation, and selected builder blocks use neutral slate selection tokens.
- Dark mode uses neutral gray/slate surfaces with `#15181C` canvas, `#1D2126` surface, `#B994F8` interactive accent, and `#2C333B` selection.
