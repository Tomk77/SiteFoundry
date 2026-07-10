# MVP scope

This is a proposed discussion boundary, not an approved specification.

## Core workflow

An administrator creates a website and registers its available page components. An editor builds pages from those components, previews changes at common responsive sizes, saves drafts, and publishes a revision. The website reads only published content unless it receives an authorized preview request.

## Candidate first-release capabilities

- Multiple websites in one installation.
- Hierarchical page tree with stable page identity and editable paths.
- Typed, ordered content blocks registered by developers.
- Draft and published states with revision history and restore.
- Responsive live preview using a documented preview bridge.
- Media library backed by S3-compatible object storage.
- Basic SEO metadata, redirects, and navigation management.
- Stable REST content API and a small framework-neutral TypeScript SDK.
- Roles for administration, editing, and publishing.
- One reference website demonstrating rendering and preview.

## Explicitly deferred

- Visual content-model builder.
- Plugin marketplace.
- Real-time multiplayer editing.
- Multi-stage approval workflows.
- GraphQL.
- Arbitrary database support.
- Free-form canvas layout.
- AI-assisted authoring.

## Acceptance signal

The MVP is useful when a developer can build a small production website and a non-technical editor can independently update, preview, publish, and safely restore its pages.
