/*
 * Layout variant registry.
 *
 * The Design Console assigns one layout variant per section through
 * theme_revisions.tokens.layout_assignments (a Record<SectionId, variantId>).
 * This module is the pure registry: the section ids, the variant metadata the
 * Console lists and the brand-rule validator checks, and the resolver that maps
 * an assignment (or its absence) to a concrete variant id.
 *
 * The variant *components* live in components/brand/variants/<section>/ and are
 * wired by id in components/brand/variants/home/index.tsx. Keeping the metadata
 * here — pure, React-free — lets lib/design/brand-rules import it to validate a
 * proposal without dragging the component tree into the validator, and mirrors
 * how palettes / font-pairings / spacing already register their vocabularies.
 */

export const SECTION_IDS = ["home.hero", "home.families"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export type LayoutVariant = {
  id: string;
  name: string;
  description: string;
  /**
   * Broken-grid editorial rhythm (vs. a uniform card grid). The home families
   * section is brand-required to use a broken-grid variant — see
   * lib/design/brand-rules.
   */
  brokenGrid: boolean;
};

export const LAYOUT_VARIANTS: Record<SectionId, LayoutVariant[]> = {
  "home.hero": [
    {
      id: "editorial",
      name: "Editorial",
      description:
        "Asymmetric: an oversized display headline overhanging the left column, with the lede and CTA on a 12-column baseline. The shipped hero.",
      brokenGrid: true,
    },
    {
      id: "centered",
      name: "Centered",
      description:
        "Symmetric: eyebrow, headline, lede, and CTA stacked and centered. Quieter and gallery-like; leads with the type.",
      brokenGrid: false,
    },
  ],
  "home.families": [
    {
      id: "broken-grid",
      name: "Broken grid",
      description:
        "Aesop-rhythm tiles on a 12-column grid with varying spans and heights. The shipped families layout.",
      brokenGrid: true,
    },
    {
      id: "uniform-grid",
      name: "Uniform grid",
      description:
        "Even three-up cards of equal height. Reads more conventional; brand rules block it on the home families section.",
      brokenGrid: false,
    },
  ],
};

export const DEFAULT_LAYOUT_VARIANTS: Record<SectionId, string> = {
  "home.hero": "editorial",
  "home.families": "broken-grid",
};

export function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value);
}

export function findLayoutVariant(
  section: SectionId,
  id: string,
): LayoutVariant | undefined {
  return LAYOUT_VARIANTS[section].find((v) => v.id === id);
}

/**
 * The variant id to render for a section: the assignment if it names a known
 * variant, otherwise the section default. Unknown ids fall back rather than
 * throwing so a stale revision never blanks the page.
 */
export function resolveLayoutVariant(
  section: SectionId,
  assignments?: Record<string, string>,
): string {
  const requested = assignments?.[section];
  if (requested && findLayoutVariant(section, requested)) return requested;
  return DEFAULT_LAYOUT_VARIANTS[section];
}
