# Specification index

- Status: Active
- Last updated: 2026-07-13

## Purpose

This file is the entry point for product and technical specifications. The repository is the project source of truth; decisions must not depend on access to a previous Codex session.

Before designing or implementing a feature:

1. Read this index.
2. Read the relevant feature specification and its dependencies.
3. Read the architecture decision records.
4. Resolve or explicitly preserve open questions.
5. Update the specification when implementation changes an agreed behaviour.

## Status definitions

- **Not started:** no dedicated specification exists.
- **Discovery:** questions are being answered and the product model is incomplete.
- **Working specification:** detailed enough to discuss but still expected to change.
- **Ready for implementation:** behaviour, boundaries, edge cases, and acceptance criteria are sufficiently defined.
- **Implemented:** the initial accepted scope is present and verified.
- **Superseded:** replaced by another specification or decision.

## Foundation documents

| Document                                               | Purpose                                                   |
| ------------------------------------------------------ | --------------------------------------------------------- |
| [Project handoff](PROJECT_HANDOFF.md)                  | Current context and how to resume work on another machine |
| [Product vision](docs/product/vision.md)               | Product intent and principles                             |
| [MVP scope](docs/product/mvp.md)                       | Initial product boundary                                  |
| [Competitor research](docs/product/competitors.md)     | Structured notes about existing CMS products              |
| [Architecture overview](docs/architecture/overview.md) | Intended system boundaries and constraints                |
| [Architecture decisions](docs/decisions/README.md)     | Accepted technical decisions and their consequences       |
| [Specification template](docs/specs/SPEC_TEMPLATE.md)  | Required structure for new feature specifications         |

## Feature roadmap

The order below is a dependency-aware planning order, not a release commitment.

| Priority | Feature                                          | Status                | Specification                                        | Depends on                                                            |
| -------: | ------------------------------------------------ | --------------------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
|        1 | Page tree and page lifecycle                     | Working specification | [Page tree specification](PAGE_TREE_SPEC.md)         | Product vision                                                        |
|        2 | Page editor and content composition              | Not started           | `docs/specs/page-editor.md`                          | Page tree, schema model                                               |
|        3 | Schema and field system                          | Not started           | `docs/specs/schema-system.md`                        | Page tree                                                             |
|        4 | Page templates                                   | Not started           | `docs/specs/page-templates.md`                       | Schema system, page editor                                            |
|        5 | Persistence and revision model                   | Not started           | `docs/specs/revisions.md`                            | Page tree, schema system                                              |
|        6 | REST content API                                 | Not started           | `docs/specs/rest-api.md`                             | Schema system, revisions                                              |
|        7 | GraphQL content API                              | Not started           | `docs/specs/graphql-api.md`                          | Schema system, revisions                                              |
|        8 | Authentication and sessions                      | Not started           | `docs/specs/authentication.md`                       | Architecture overview                                                 |
|        9 | Permissions                                      | Not started           | `docs/specs/permissions.md`                          | Authentication, page tree                                             |
|       10 | Personal settings                                | Working specification | [Personal settings](docs/specs/personal-settings.md) | Authentication, permissions                                           |
|       11 | Redirects and URL changes                        | Not started           | `docs/specs/redirects.md`                            | Page tree, permissions                                                |
|       12 | Multi-site and languages                         | Not started           | `docs/specs/sites-and-languages.md`                  | Page tree, permissions                                                |
|       13 | Translation relationships                        | Not started           | `docs/specs/translations.md`                         | Sites and languages                                                   |
|       14 | Header navigation and footer                     | Not started           | `docs/specs/navigation-and-footer.md`                | Page tree, sites and languages                                        |
|       15 | Media library                                    | Not started           | `docs/specs/media-library.md`                        | Permissions, storage                                                  |
|       16 | Structured non-page content                      | Not started           | `docs/specs/structured-content.md`                   | Schema system, permissions                                            |
|       17 | Live preview                                     | Not started           | `docs/specs/live-preview.md`                         | Page editor, content APIs                                             |
|       18 | Frontend delivery SDK and preview bridge package | Not started           | `docs/specs/frontend-sdk.md`                         | Live preview, REST and GraphQL content APIs, stable block identifiers |
|       19 | Search, filtering, and validation                | Not started           | `docs/specs/search-and-validation.md`                | Page tree, schema system                                              |
|       20 | Admin information architecture                   | Not started           | `docs/specs/admin-information-architecture.md`       | All editor-facing features                                            |
|       21 | Background jobs and webhooks                     | Not started           | `docs/specs/jobs-and-webhooks.md`                    | Publishing, content APIs                                              |
|       22 | Deployment and configuration                     | Not started           | `docs/specs/deployment.md`                           | Architecture overview                                                 |
|       23 | Plugin and extension system                      | Deferred              | `docs/specs/plugin-system.md`                        | Stable core APIs                                                      |
|       24 | Data migrations                                  | Deferred              | `docs/specs/data-migrations.md`                      | Schema system, revisions                                              |

## Cross-cutting requirements

Every relevant feature specification must address:

- multi-site and language scoping;
- permissions and unauthorized behaviour;
- concept versus published data;
- REST and GraphQL exposure;
- stable identifiers and reference integrity;
- validation and actionable error messages;
- destructive-operation warnings;
- performance expectations;
- accessibility and keyboard operation;
- auditability and future versioning;
- local-development versus production behaviour;
- open-source and self-hosting requirements.

## Recommended next specifications

The next discovery conversations should cover:

1. **Schema and field system:** what developers can model and how JSON schema files behave.
2. **Page editor and content composition:** how editors build a freely customizable page.
3. **Persistence and revisions:** concrete page, revision, concept, and autosave storage semantics.
4. **REST and GraphQL APIs:** the contract consuming websites will depend on.

These four areas determine most downstream architecture and should be understood before substantial CMS implementation begins.

## Frontend SDK scope to explore

The frontend SDK should be developed as a separate Git package and should explore two related responsibilities:

- retrieving published and authorized preview data from SiteFoundry;
- coupling the consuming website to editor preview behaviour such as stable block and field identifiers, block and field selection events, selection outlines, synchronized scrolling, exact editor-field focus, and secure `postMessage` communication.

The eventual data-fetching API, framework-specific adapters, caching behaviour, and authentication model remain open. GraphQL consumers may initially need to provide manually written queries; whether the package later generates typed clients or query helpers will be decided when the GraphQL API is specified.

## Maintenance rules

- One feature specification should have one primary file.
- Use links instead of duplicating detailed rules across specifications.
- Record accepted architectural choices as ADRs under `docs/decisions`.
- Mark assumptions explicitly.
- Keep unresolved product choices in an `Open questions` section.
- Add measurable acceptance criteria before marking a specification ready.
- When code and a specification disagree, resolve the discrepancy rather than silently treating either as correct.
- Update `Last updated` and the feature status when a specification materially changes.
