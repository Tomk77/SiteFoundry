# Architecture overview

## Current direction

TanStack Start is the initial application framework for the administration interface and early server endpoints. The CMS domain must remain independent of TanStack and React so that it can later run in a separate service and serve websites built with any framework.

```text
CMS administration
      |
      v
Application and content API
      |
      +---- PostgreSQL
      +---- S3-compatible object storage

Consuming websites <---- published API / SDK
Preview website    <---- authorized draft API + preview bridge
```

## Intended boundaries

- **Admin UI:** routes, editing state, page trees, media views, and preview controls.
- **Application layer:** use cases such as save draft, publish revision, move page, and restore revision.
- **Domain layer:** framework-neutral models and rules for websites, pages, schemas, blocks, revisions, and permissions.
- **Persistence layer:** PostgreSQL repositories, migrations, and object-storage integration.
- **Delivery layer:** stable HTTP API, preview authorization, webhooks, and SDKs.

The administration application's feature-first source layout and dependency direction are defined in
[Administration frontend structure](frontend-structure.md).

## Constraints

- Tenant and website boundaries must be explicit in data access and authorization.
- Draft data must never leak through the public delivery API.
- A published revision should be reproducible and independently addressable.
- Page identity must not be coupled to its current URL.
- Stored blocks require versioned definitions and a migration strategy.
- Framework-specific preview helpers must sit above a framework-neutral protocol.

## Decisions not yet made

- Single deployable application versus separate API service.
- Code-defined versus UI-defined content schemas.
- Authentication and session implementation.
- Database access and migration library.
- Rich-text representation and editor.
- Event, webhook, and background-job infrastructure.
- Public API shape and caching model.
