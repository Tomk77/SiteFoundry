# Architecture decision records

Architecture decision records explain important technical choices and their consequences. They should capture decisions that would otherwise be repeatedly reconsidered.

## Status values

- **Proposed:** under discussion.
- **Accepted:** the current direction.
- **Superseded:** replaced by a later record.

## Index

- [ADR 0001: Use TanStack Start for the initial application](0001-tanstack-start.md)
- [ADR 0002: Use Tailwind CSS for administration styling](0002-tailwind-admin-styling.md)
- [ADR 0003: Share one published delivery layer between REST and GraphQL](0003-shared-delivery-layer.md)
- [ADR 0005: Test the database with PGlite replaying the repository migrations](0005-local-database-tests.md)
- [ADR 0006: Compute delivered page paths at read time](0006-delivered-page-paths.md)

## Template

```markdown
# ADR NNNN: Decision title

- Status: Proposed
- Date: YYYY-MM-DD

## Context

## Decision

## Consequences

## Revisit when
```
