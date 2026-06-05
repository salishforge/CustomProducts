import type { Route } from "next";

import type { MaterialToken } from "@/components/brand/FamilyTile";

/*
 * Stable props contracts shared by every home-section layout variant.
 *
 * The page computes content once; each variant lays out the same content
 * differently. Keeping the contracts here (not in the variant index) avoids a
 * runtime import cycle between the index switcher and the variant components.
 */

export type HeroContent = {
  /** Mono eyebrow above the headline (e.g. the featured SKU + dimensions). */
  eyebrow: string;
  /** Display headline; "\n" marks a hard line break. */
  title: string;
  lede: string;
  ctaHref: Route;
  ctaLabel: string;
};

export type FamilyItem = {
  /** product_category enum value; doubles as the React key. */
  category: string;
  name: string;
  caption: string;
  href: string;
  material: MaterialToken;
};
