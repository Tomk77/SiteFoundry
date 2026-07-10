# Product vision

Working product name: **SiteFoundry**.

## Working statement

Build an open-source CMS specifically for creating and operating websites. Pages, URLs, navigation, reusable sections, preview, SEO, redirects, localization, and publishing should be native concepts rather than conventions assembled separately for every project.

## Intended users

The initial audience is still a product decision. Likely candidates are:

- developers and freelancers delivering client websites;
- digital agencies maintaining many websites;
- in-house web teams working with non-technical editors.

Choosing the primary audience is required before finalizing the first release.

## Product principles

1. **Website-native:** Optimize for websites instead of acting as a generic database interface.
2. **Editor confidence:** Preview must faithfully represent the published website.
3. **Developer control:** Content structure and visual components remain explicit, typed, and versionable.
4. **Portable content:** Consuming websites are not required to use TanStack, React, or a particular host.
5. **Open operation:** A complete useful installation must be self-hostable without paid feature gates.
6. **Deliberate flexibility:** Prefer a coherent workflow over unlimited configuration.

## Questions to resolve

- Is an installation intended for one organization, one agency, or one website?
- Are schemas defined in code, in the admin interface, or through a controlled combination?
- Does the CMS render and host websites, or provide content and preview contracts to them?
- How much layout freedom should an editor have?
- What are the three recurring frustrations that existing CMS products fail to solve?
- Which capabilities must remain free and open-source permanently?

## Non-goals for now

- Competing with free-form visual design tools.
- Supporting every database or frontend framework in the first release.
- Building AI features before the core editorial workflow works.
- Replacing ecommerce, analytics, experimentation, or digital asset management platforms.
