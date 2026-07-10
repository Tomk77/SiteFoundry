# ADR 0001: Use TanStack Start for the initial application

- Status: Accepted
- Date: 2026-07-10

## Context

The CMS administration interface will be a highly interactive React application with nested routes, typed URL state, substantial server state, optimistic updates, and live preview. The project also needs server rendering, server-only operations, and API endpoints during its early development.

TanStack Start provides those capabilities through TanStack Router and Vite. At the time of this decision it is a release candidate, so some ecosystem and upgrade risk remains.

## Decision

Use TanStack Start for the initial administration application and early server layer. Keep CMS domain models and rules free of React and TanStack dependencies. Do not require consuming websites to use TanStack.

Pin TanStack package versions and treat framework upgrades as planned changes verified by route generation, type checking, tests, and a production build.

## Consequences

- The admin benefits from strongly typed routing, search parameters, loaders, and server functions.
- One application can support rapid product exploration before separate services are justified.
- Framework-specific code must not enter the domain layer.
- The project accepts some short-term release-candidate tooling friction.
- Preview and content-delivery protocols must be documented independently of the React implementation.

## Revisit when

- The server layer needs to scale or deploy independently.
- Non-React administration clients become a requirement.
- TanStack Start changes its stability or deployment guarantees materially.
- Framework coupling begins to leak into domain or delivery contracts.
