# Scaffold CMS project notes

Design work for the **Scaffold CMS** admin, an open-source, headless, website-native CMS. The source of truth is the codebase documentation (`SPEC_INDEX.md`, `PAGE_TREE_SPEC.md`, `PROJECT_HANDOFF.md`, and `docs/`).

## Design system (approved)

- **Palette: Scaffold Amethyst and Fired Clay.**
  - Canvas `#F5F7F4`, Surface `#FFFFFF`, Sunken `#EEF1ED`, Border `#E2E7E2`.
  - Ink 900 `#172326`, Ink 600 `#526366`, Ink 400 `#869693`.
  - **Amethyst** is the single interactive accent for actions and focus: 600 `#763FBA`, 700 `#5E299C`, soft `#F3ECFF`, disabled `#A693CC`, focus ring `rgba(118,63,186,.16)`. Dark-mode accent `#B994F8`, hover `#CFB3FF`, soft `#332647`, on-accent `#150C22`.
  - **Selection is neutral, not accent-colored:** selected background `#ECEEF1`, selected surface `#F4F6F8`, border `#CBD3DB`, rail `#96A0AC`. Dark selection uses `#2C333B`.
  - Petrol `#0D6770` and Mulberry are retired. Do not use them as product accents.
  - **Clay** is for brand moments only, such as the logo mark, site indicator, and empty states: `#E07A4F`, dark `#B45F38`, soft `#FBEBE1`. Never use Clay for status.
  - Status always includes a dot and label. Published `#147A4A` / `#E3F3EA` / `#1F9D57`; Concept `#8A5A06` / `#F7EDDA` / `#D18F0C`; Validation `#B5382C` / `#F8E6E3` / `#DC4436`.

### Dark-mode tokens

- Canvas `#15181C`, Surface `#1D2126`, Sunken `#242930`, Border `#323841`.
- Ink `#E9ECF1`, Ink 2 `#A7AEB8`, Ink 3 `#79808B`.
- Field border `#3D444E`.
- Accent `#B994F8`, Accent hover `#CFB3FF`, Accent soft `#332647`, On-accent `#150C22`.
- Neutral selection highlight `#2C333B` and selection border `#515A65`.
- Focus ring `rgba(185,148,248,.22)`.
- Success `#4FBE86`, Danger `#F0857A`, Warning `#E0B341`.
- `system` follows `prefers-color-scheme` and reacts live. Explicit `light` and `dark` override it. Apply the mode before authenticated UI paints to avoid a flash.

## Type, shape, and icons

- **Type:** Geist for UI and Geist Mono for paths, slugs, and IDs. Avoid Inter and Roboto.
- **Radius:** controls 7px, cards 10px, panels 12px, and full pills where specified.
- **Icons:** Phosphor (`@phosphor-icons/web`).
- Use headless primitives such as Base UI, Radix Primitives, or React Aria and style them with Scaffold CMS tokens. Do not introduce an off-the-shelf visual kit.

## Build conventions

- Design references are Design Components (`Name.dc.html`) with inline styles.
- The production implementation belongs in the TanStack Start and React application.
- Reserve green for Published and keep Clay out of status.
