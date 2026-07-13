# SiteFoundry — project notes

Design work for the **SiteFoundry** admin (open-source, headless, website-native CMS). Source of truth is the codebase docs (SPEC_INDEX.md, PAGE_TREE_SPEC.md, PROJECT_HANDOFF.md, docs/).

## Design system (approved)
- **Palette: Foundry Petrol & Fired Clay.**
  - Canvas `#F5F7F4` · Surface `#FFFFFF` · Sunken `#EEF1ED` · Border `#E2E7E2`
  - Ink 900 `#172326` · Ink 600 `#526366` · Ink 400 `#869693`
  - **Petrol** (the single interactive accent — actions, active nav, selection, focus): 600 `#0D6770`, 700 `#0A545C`, 200 `#A7D4CE`, soft `#DCEDEA`
  - **Clay** (brand moments ONLY — logo mark, site indicator, empty states; never status): `#E07A4F`, dark `#B45F38`, soft `#FBEBE1`
  - Status (always paired with a dot + label, never color alone): Published `#147A4A`/`#E3F3EA`/`#1F9D57` · Concept `#8A5A06`/`#F7EDDA`/`#D18F0C` · Validation `#B5382C`/`#F8E6E3`/`#DC4436`
  - Dark-mode seed values exist (canvas `#101718`, surface `#172123`, text `#EDF4F2`, interactive `#58C3C7`, accent `#F09A73`).
  - **Dark-mode token set (full, used in Personal Settings — light → dark):** these expand the seeds into a 1:1 mappable set. Not yet formally approved; review before locking into tokens.
    - `bg` (canvas) `#F5F7F4` → `#101718` · `surface` `#FFFFFF` → `#172123` · `sunken` `#EEF1ED` → `#1E2A2B` · `border` `#E2E7E2` → `#2A3739`
    - `ink` `#172326` → `#EDF4F2` · `ink-2` `#526366` → `#A9B7B5` · `ink-3` (muted) `#869693` → `#7C8C8A`
    - `field` (input border) `#CFD6D0` → `#35474A`
    - `accent` `#0D6770` → `#58C3C7` · `accent-hover` `#0A545C` → `#7FD3D6` · `accent-soft` `#DCEDEA` → `#173033` · `on-accent` (text on solid buttons) `#FFFFFF` → `#0A2224`
    - `focus-ring` `rgba(13,103,112,.16)` → `rgba(88,195,199,.22)`
    - `success` `#147A4A` → `#4FBE86` · `danger` `#B5382C` → `#F0857A` · `warning` `#B8860B` → `#E0B341`
    - Mode resolution: `system` follows `prefers-color-scheme` and reacts live; explicit `light`/`dark` override it. Apply the theme before the authenticated UI paints to avoid a flash.
- **Type:** Geist (UI) + Geist Mono (paths, slugs, IDs). Avoid Inter/Roboto.
- **Radius:** control 7px, card 10px, panel 12px, pill.

## Icons & UI direction (to avoid generic-AI look)
- **Icons: Phosphor** (`@phosphor-icons/web` font — `<i class="ph ph-name">`). Not Lucide (it reads as the current default).
- **Intended real stack:** headless primitives (**Radix Primitives** or **React Aria**) styled with the Petrol/Clay tokens — NOT an off-the-shelf styled kit like default shadcn/ui. Keeps the product looking bespoke on the TanStack Start / React codebase.

## Build conventions
- Everything is a Design Component (`Name.dc.html`), inline styles only.
- Reserve green for "Published"; keep clay out of status.
