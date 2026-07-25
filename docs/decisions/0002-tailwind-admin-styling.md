# ADR 0002: Use Tailwind CSS for administration styling

- Status: Accepted
- Date: 2026-07-21

## Context

The administration application began with screen-specific global `.sc-*` styles copied from
interactive design prototypes. Tailwind CSS 4 and local Base UI primitives were later introduced,
leaving two parallel styling systems: reusable Tailwind primitives and several thousand lines of
global feature CSS. The duplicated light and dark palettes, cross-feature stylesheet imports, and
unstyled primitive escape hatches make visual changes difficult to apply consistently.

Scaffold CMS has an approved visual language built around Scaffold Amethyst, Fired Clay, Geist,
neutral selection colors, explicit status colors, and light, dark, and system themes. The styling
implementation must preserve that visual language rather than adopt a generic component theme.

## Decision

Use Tailwind CSS 4 as the styling system for the administration application.

- Configure Tailwind through the CSS-first `@theme inline` API and the Vite plugin.
- Keep Scaffold CMS semantic CSS variables as the source of truth for runtime light and dark themes.
- Expose those variables as named Tailwind colors, fonts, radii, and shadows.
- Keep Base UI as the headless interaction layer and keep UI component source in this repository.
- Compose conditional classes with `cn` and finite component variants with CVA.
- Use complete, statically detectable utility strings instead of constructing class names at runtime.
- Retain small custom CSS rules for keyframes, complex pseudo-elements, third-party overrides, and
  values that genuinely depend on runtime content.
- Migrate existing screens incrementally, deleting obsolete selectors as each component moves.

Tailwind is an administration implementation detail. It must not enter the CMS domain model,
delivery APIs, frontend SDK protocol, or impose a framework or styling choice on consuming sites.

## Consequences

- The approved theme can change through a single semantic token layer.
- Shared controls and state variants become consistent across screens.
- Most layout and component styling lives beside the React markup that owns it.
- Visual regression testing is required while legacy CSS is migrated.
- Exact prototype values may use arbitrary utilities until a value is repeated enough to deserve a
  named token.
- Legacy styles may coexist temporarily, but new cross-feature stylesheet dependencies are not
  allowed.

## Implementation status

The administration migration was completed on 2026-07-21. All product screens now use Tailwind
utilities in their React owners. The former route-owned stylesheets were deleted; only theme and
global element foundations remain in `src/styles.css`, with shared keyframes isolated in
`src/animations.css`. Semantic `sc-*` class names may remain in markup as stable interaction and
test hooks, but no longer own CSS declarations.

## Revisit when

- The administration interface is extracted into a separately versioned package.
- A non-React administration client must share the same component implementation.
- Tailwind's CSS-first configuration or browser support changes materially.
