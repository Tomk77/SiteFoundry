# ADR 0003: Share one published delivery layer between REST and GraphQL

- Status: Accepted
- Date: 2026-07-22

## Context

Scaffold CMS must serve the same published website data through REST and GraphQL. The administration
proof of concept stores editable data in Supabase and previously had no safe anonymous delivery
boundary or immutable published page snapshots. Letting each protocol query tables independently would
duplicate authorization and make REST and GraphQL disagree.

## Decision

Use one framework-neutral delivery model and one database authorization boundary for both protocols.

- Delivery URLs identify a site with its stable readable key.
- A site-owned publishable read token is required for every request.
- The database validates the token, site, expiry, revocation, scope, allowed browser origin, and rate
  limit before returning a delivery bundle.
- Delivery reads immutable page and structured-record publication snapshots.
- REST and GraphQL are thin server-route adapters over the same parsed bundle.
- GraphQL has one universal `Page` type and typed reusable block variants; templates are not API types.
- Published content schemas are snapshotted explicitly so editing field definitions does not
  immediately change the public GraphQL schema.

The initial server routes live in TanStack Start. Domain types do not import TanStack, React,
Supabase, or GraphQL.

## Consequences

- REST and GraphQL expose consistent data and authorization behavior.
- Publishable tokens may appear in browser code and therefore do not protect secret content.
- Draft delivery requires a separate confidential preview-token design.
- The current bundle RPC favors a coherent first contract over large-site query efficiency; resource-
  specific repositories can replace it without changing public contracts.
- Media currently has no persisted domain model, so the delivery media collection is empty until that
  model is implemented.

## Revisit when

- Delivery data is too large for a single bundle query.
- The API server deploys independently from the administration application.
- Draft preview, field-level permissions, CDN invalidation, or persisted GraphQL schemas are added.
