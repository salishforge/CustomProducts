# Salishforge — Brand Rules

Source of truth for the Design Console LLM and the `brand-rules.ts` validator.
Edit this file when the brand evolves; the runtime reads it via the validator,
so changes here propagate to what the LLM is allowed to propose.

## Identity

- Target adjective: **forged**, not "minimal."
- Visual references: Aesop, Teenage Engineering, Hermès Maison, Apple Pro
  micro-sites, Field Notes.
- Negative references: Stripe / Vercel / Linear-app-chrome SaaS look, generic
  AI-generated React commerce templates.

## Hard rules (validator enforces; LLM proposals that violate are rejected)

1. **One accent color.** A theme exposes exactly one chromatic ramp
   (`--ember-*`). No second accent. Materials (`--mat-*`) are not accents;
   they're tints scoped to product families.
2. **Editorial display serif paired with humanist sans + mono.** The display
   face must be a serif. The body must be a humanist or geometric sans. A
   mono is required (for SKUs, dimensions, prices).
3. **Tabular slashed-zero on prices and counts.** Themes cannot disable this
   (Tailwind utility `.nums-tabular` is part of globals.css; rule applies to
   prompt scaffolding for the LLM, not the validator).
4. **Broken-grid editorial layouts on home/category.** Layout variants for
   these sections must be tagged `editorial: true` in their registration.
5. **No fade-in-on-scroll.** Reserved for the customizer's stage skeleton
   (an explicit content signal), never decoration.
6. **No glassmorphism on content surfaces.** Allowed only on the customizer's
   floating tool panels (where it reveals product preview beneath) and on
   the mobile bottom-sheet handle.
7. **Surface noise (4-octave SVG turbulence, α ≤ 0.04) on large light
   surfaces.** Imperceptible until removed; the moment a theme removes it
   the page reads flat and digital.
8. **Sub-pixel hairlines via `border-image`.** 1 px solid is forbidden on
   internal dividers; reserved for explicit emphasis.
9. **Body type ≤ 17 px.** Display headings allowed to overhang column edges.
10. **Spacing scale must produce a body line-height ≥ 1.5.** Tighter is fine
    on display; body breathes.

## Vocabulary the LLM can choose from

- **Palettes** — `lib/design/palettes/*.ts`. ~6–10 curated OKLCH ramps,
  each WCAG AA contrast-tested for body text on `--paper-50`, with the
  ember accent in the brand's warmth band (hue 30–50).
- **Font pairings** — `lib/design/font-pairings/*.ts`. 12–20 hand-picked
  (display, body, mono) triplets referencing pre-installed faces.
- **Spacing scales** — `lib/design/spacing/*.ts`. 3 (current, tighter,
  generous).
- **Layout variants per section** — `components/brand/variants/<section>/`.
  3–5 per section, all satisfying the editorial-grammar rule for editorial
  pages.

## What the Console cannot do (intentional)

- Add a new palette, font, layout variant, or spacing scale (dev change)
- Mutate motion presets, durations, or easings
- Change `design_brief.md` rules
- Modify the customizer's design (separate React tree insulated from theme)
- Change typography on the order-confirmation email (kept stable for brand
  consistency post-purchase)
