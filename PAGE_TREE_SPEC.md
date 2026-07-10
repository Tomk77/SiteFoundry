# Page tree specification

- Status: Working specification
- Version: 0.1
- Date: 2026-07-10
- Scope: Foundational CMS information architecture, page tree, page lifecycle, and related API behaviour

## 1. Purpose

The CMS is an open-source, headless CMS designed around how editors understand websites. Its primary content view is a canonical website tree rather than a collection of disconnected content records.

The tree must make it easy for an editor to answer:

- Where does this page live on the website?
- What is its URL?
- Which pages are below it?
- Is it a concept or published?
- What will be affected if it is moved, renamed, or deleted?

Visual styling is outside this specification. The behaviours and information architecture defined here should be usable as input for a later UI design phase.

## 2. Product principles

1. **Website-first:** Editors work with sites, languages, pages, URLs, navigation, and footers—not database objects.
2. **No dangling pages:** Every page belongs to one valid canonical tree.
3. **Freedom over convention:** Templates help users begin but never constrain what a page may become or where it may live.
4. **Safe structural changes:** The CMS explains every URL and reference affected by a move, rename, or deletion.
5. **Headless delivery:** The CMS supplies data; the consuming website controls rendering and layout.
6. **Stable identity:** Page references use stable IDs and do not break when URLs change.
7. **Explicit publishing:** Concepts never become public until an authorized user publishes them.

## 3. Terminology

### Site

One independently managed website. An installation may contain multiple sites.

### Language

A site-specific language with its own canonical page tree, header navigation, and footer configuration.

### Page

The universal routable content object. Every page has a stable ID, language, parent, position among siblings, slug, derived URL, content, metadata, and publication state.

There are no rigid page types. A news article, standard page, landing page, or FAQ is still a page.

### Page template

A copy-on-create starting point that pre-populates a page with a recommended structure and initial values. Examples include Standard page, News overview, News article, Blog overview, and Blog article.

The page becomes independent immediately after creation. Later changes to the template do not update existing pages.

### Content type

Non-page structured data such as colleagues, categories, offices, or reusable records. Content-type records may be referenced by pages but can never independently occupy a position in a page tree.

### Concept

An unpublished page revision. A new page or a changed published page may be saved as a concept.

### Published revision

The revision currently exposed through the public content APIs.

### Autosave working copy

A temporary recoverable editing state. It is stored separately from permanent revisions and never appears in revision history.

## 4. Application information architecture

The upper-left application area contains the active site selector. Changing the active site changes all site-scoped sections.

The primary left navigation contains major areas of work rather than a list of page templates or schemas:

- Pages
- Media
- Redirects
- Header navigation
- Footer
- Structured content
- Settings

Developer-only schema and template tools are available in local development and must not be present in production.

The precise grouping and naming of secondary sections is a later design decision. The left navigation must never become a list of every page template.

## 5. Site and language hierarchy

The content hierarchy is:

```text
Installation
└── Site
    └── Language
        └── Canonical page tree
```

Each language has an independent tree. A fully translated Dutch and English site may coexist with small French and Spanish trees containing only a few pages.

Structural synchronization between languages is not required.

### 5.1 Homepage

Every language tree has exactly one required homepage representing `/` within that language's URL strategy.

The homepage:

- is the root page of the language tree;
- has no page parent;
- cannot be moved beneath another page;
- cannot be deleted without first replacing it with another homepage;
- may have any number of descendants.

### 5.2 Translation links

Pages in different language trees may be linked as translations of one another.

- A translation link is optional.
- Missing translations are valid.
- A page may link to at most one corresponding page per other language.
- Translation links do not synchronize content, URLs, parents, descendants, or publication state.
- Switching language from a page detail view opens the linked page when it exists.
- When no link exists, the UI indicates this and may offer to create a translated page.
- Creating a translation must not recreate the source page's entire ancestor or descendant structure automatically.

## 6. Canonical tree and URL rules

The page tree is the source of truth for canonical URL structure.

- Every non-homepage page has exactly one existing parent.
- Every page belongs to exactly one site language.
- A full URL is derived from the ordered ancestor slugs and the page's own slug.
- A path such as `/test/parent/page` is impossible unless the pages representing `/test` and `/test/parent` exist.
- Two pages in the same language tree may not resolve to the same canonical URL.
- A page may not become its own ancestor.
- Deleting a parent never implicitly deletes its descendants.

Page identity is independent of URL. Internal references use page IDs rather than stored paths.

## 7. Page ordering

Pages have an explicit manual order among siblings.

- Drag-and-drop reorders a page within its current parent.
- Drag-and-drop onto a different parent reparents the page.
- The persisted sibling order is canonical.
- REST and GraphQL expose children in canonical order and include an explicit ordering value.

The initial implementation must comfortably support approximately 2,000 pages per language tree.

## 8. Tree view

### 8.1 Row information

Each visible page row initially shows:

- page title;
- current slug or path;
- originating template;
- publication status;
- validation-problem indicator;
- contextual actions menu.

More metadata may be introduced later without changing the underlying tree model.

### 8.2 Expansion and state preservation

The tree supports expanding and collapsing branches.

Tree state includes:

- active site;
- active language;
- search query;
- filters;
- expanded branches;
- selected or last-opened page;
- scroll position.

Opening a page replaces the tree with a dedicated detail view. A prominent return action restores the previous tree state. A direct link to a page detail view must also provide a reliable way to reveal that page in its tree.

### 8.3 Search and filters

The initial filter set contains:

- text search;
- one or more originating page templates;
- publication status: Concept or Published;
- language;
- author;
- validation problems.

When a page matches a filter, its ancestor chain remains visible so the result retains its location context. Non-matching ancestors may be visually muted. Filters must help an editor find a destination parent before adding or moving a page.

The filter architecture must allow additional filters later.

### 8.4 Performance

The tree should load compact metadata rather than full page content. Rendering should remain responsive at the 2,000-page target, including filtered and expanded views. Virtualized rendering or an equivalent strategy may be used where necessary.

## 9. Page templates

### 9.1 Copy-on-create behaviour

Applying a template:

1. copies its initial page structure and values;
2. records which template originated the page;
3. creates an independent page;
4. places no continuing restrictions on that page.

Editors may freely add, remove, reorder, or reconfigure content after creation.

Originating-template metadata remains available for filtering and reporting. It does not imply conformance to the current template.

### 9.2 Placement freedom

Templates never define allowed parents or children in the initial version.

- Any page may be placed beneath any other page.
- An overview may appear beneath another overview.
- An FAQ may appear beneath a news article.
- The CMS blocks only technically invalid structures, path collisions, and unauthorized operations.

### 9.3 Default templates

Every site has one required fallback page template.

- Developers can modify it locally.
- It cannot be deleted until another template becomes the fallback.
- A page may configure a preferred default template for newly created children.
- A parent's preferred child template overrides the site fallback only as a creation convenience.
- Neither default restricts the other templates an editor may choose.

## 10. Creating pages

Each page row offers a plus action for creating a child at that location.

When the parent has a preferred child template, the creation menu prioritizes:

1. `Add {preferred template name}`
2. `Add different kind of page…`

The second action opens a template-selection dialog.

When no preferred child template is configured, the quick action uses the site's fallback template and still offers the template-selection dialog.

Creation requirements:

- The parent and language are known before creation.
- The new page receives a stable ID.
- Its slug must be valid and unique among URL-equivalent siblings.
- It begins as a concept.
- The editor may alter all template-provided content.

## 11. Page detail view

Clicking a tree row opens a dedicated page detail/edit view.

The detail view must provide:

- a prominent return-to-tree action;
- a breadcrumb showing the page's canonical ancestry;
- the current canonical path;
- concept and published state;
- validation feedback;
- page content editing;
- slug and page settings;
- translation links;
- the preferred child template setting;
- save-as-concept and publish actions when permitted.

The exact layout and contextual editing of structured content are deferred to the design specification.

## 12. Moving and renaming pages

Changing a slug or parent may change the canonical URLs of the page and all its descendants.

Before committing the change, the CMS shows an impact review containing:

- every affected page;
- its current URL;
- its proposed URL;
- collisions or validation problems;
- redirect records that will be created;
- affected header, footer, or structured-content references where relevant.

The operation is blocked when:

- a proposed canonical URL collides with another page;
- the page would become its own ancestor;
- an automatic redirect conflicts with an existing canonical path or redirect;
- the user lacks permission for the source, destination, page, or affected descendants.

For previously published URLs, successful moves and renames automatically create redirects from every affected old URL to its new URL.

Redirects are managed in their own application section and may also be created manually.

## 13. Deleting pages

A page with children cannot be deleted. The user must first move or otherwise reparent every child.

Before deletion, the CMS shows:

- references from header navigation, footer, redirects, and structured content;
- the page's current publication state;
- an optional redirect destination for a previously published URL.

Creating a redirect is recommended but not required. If declined, the old URL becomes unavailable.

The required homepage cannot be deleted until a replacement homepage is assigned.

Whether initial deletion is permanent or uses an archive/recycle-bin stage remains a separate lifecycle decision.

## 14. Navigation and footer

The canonical page tree does not define visible website navigation.

Header navigation and footer configuration:

- are managed in separate left-navigation sections;
- are independent for every site language;
- may reference pages by stable ID;
- may include external URLs;
- have their own manual hierarchy and order;
- are exposed through REST and GraphQL.

The consuming website decides how and where these structures are rendered. The CMS does not inject them into page content or require a specific website layout.

## 15. Concepts, publishing, and persistence

### 15.1 Concepts

Saving as a concept is always available for new pages and edited published pages.

- A new page remains unavailable through the published API until published.
- Editing a published page does not overwrite the live revision.
- The existing published revision remains available while a newer concept is edited.

### 15.2 Permanent revisions

Every explicit save creates a new permanent revision row.

- Revisions are append-oriented and are not overwritten in place.
- A page maintains pointers or equivalent relationships to its current concept and published revisions.
- Publishing makes a selected concept revision the live revision.
- The initial data model must support future history, comparison, and restoration features.
- A full version-history UI is not required initially.

### 15.3 Autosave

Autosave uses a separate temporary working-copy store.

- Only the latest recoverable working copy is required.
- Autosaves do not appear in permanent revision history.
- Reopening a page may offer recovery of an autosaved working copy.
- An explicit save or deliberate discard clears the temporary working copy.

## 16. Permissions

Permissions are capability- and resource-scoped.

Scopes include:

- installation;
- site;
- language;
- one or more page subtrees;
- application sections such as media, redirects, navigation, footer, structured content, schemas, settings, and users.

Page capabilities include at least:

- view;
- create;
- edit;
- reorder;
- move;
- delete or archive;
- publish.

Granting access to a subtree automatically includes all current and future descendants unless a more specific rule overrides it.

The interface only exposes sites, languages, branches, actions, and sections the user may access.

Moving a page requires authorization for:

- the page and affected descendants;
- the old parent;
- the new parent;
- reordering in both affected sibling sets;
- every resulting structural or redirect mutation.

The exact role-builder interface and conflict-resolution algorithm require a dedicated permission specification.

## 17. Schemas and local development

Page structure, templates, and non-page content types are configured through an admin-facing builder available only in local development.

- Schemas are saved as JSON files in the application repository.
- Production loads deployed schemas as read-only configuration.
- Production must not expose schema-editing routes or APIs.
- Schema changes require a commit and new CMS deployment.
- Git or another source-control system provides schema version history.
- Consuming website code may need a coordinated deployment when schemas change.

Fields require stable internal IDs so labels and API-facing names can be renamed without losing stored data.

Deleting a populated field:

- is allowed in the initial version;
- displays a strong destructive-change warning;
- reports how much content is affected where practical;
- requires explicit confirmation.

Automated data migrations and migration definitions are deferred.

## 18. Headless APIs

The CMS is headless and open source. It provides both REST and GraphQL APIs.

The APIs must support:

- retrieving a page by stable ID or canonical path;
- resolving only the active language tree;
- retrieving ordered children and ancestors;
- retrieving the current published revision publicly;
- retrieving concepts only with explicit authorization;
- retrieving translation relationships;
- retrieving language-specific header navigation and footer data;
- retrieving structured content and media references;
- resolving redirects;
- exposing stable IDs independently of URLs.

Public responses must never leak concept or autosave data.

The exact REST resources, GraphQL schema, pagination, caching, preview authentication, and error formats require a dedicated API specification.

## 19. Validation and failure behaviour

At minimum, validation covers:

- required page data;
- slug syntax;
- canonical path uniqueness;
- valid parent existence;
- cycle prevention;
- homepage invariants;
- redirect conflicts;
- reference integrity;
- schema compatibility;
- permission checks.

A validation failure must explain which page or reference caused it and how the user can resolve it. Structural operations must be atomic: a failed move, rename, reorder, or delete must not leave a partially changed tree.

## 20. Initial acceptance criteria

The foundational page-tree feature is acceptable when:

1. An authorized editor can select a site and language and see its canonical tree.
2. Every language has one protected homepage.
3. A user can search and filter pages while retaining ancestor context.
4. A user can add a child with the parent's preferred template or choose another template.
5. The created page is independent of its originating template.
6. A user can reorder and reparent pages with drag-and-drop.
7. Invalid cycles, dangling pages, and URL collisions cannot be created.
8. Moves and slug changes show all affected URLs before confirmation.
9. Published URL changes create the required redirects.
10. A page with children cannot be deleted.
11. Deleting a published leaf page offers, but does not require, a redirect.
12. Opening and returning from a page preserves tree context.
13. A published page can retain its live revision while a concept is edited.
14. Every explicit save creates a permanent revision, while autosave remains temporary.
15. Site, language, subtree, and action permissions are enforced.
16. REST and GraphQL expose published page trees, ordering, navigation, footer, and redirects without leaking concepts.
17. The tree remains responsive with approximately 2,000 pages in one language.

## 21. Explicitly deferred

- Synchronizing template changes to existing pages.
- Template-based parent or child restrictions.
- Automated content data migrations.
- Full revision-history, comparison, and restore UI.
- Scheduled publishing and multi-page releases.
- Additional filters and tree-row metadata.
- Free-form visual website design.
- Detailed navigation, footer, media, redirect, schema-builder, API, preview, and permission UI specifications.

## 22. Follow-up specifications

The next useful documents are:

1. Page editor and content-composition specification.
2. Schema and template builder specification.
3. REST and GraphQL API specification.
4. Permission model specification.
5. Redirect and structural-change specification.
6. Navigation and footer specification.
7. Preview integration specification.
