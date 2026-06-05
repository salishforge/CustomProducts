import { DEFAULT_LAYOUT_VARIANTS } from "@/lib/design/layouts";

import { HeroEditorial } from "./hero-editorial";
import { HeroCentered } from "./hero-centered";
import { FamiliesBrokenGrid } from "./families-broken-grid";
import { FamiliesUniformGrid } from "./families-uniform-grid";
import type { FamilyItem, HeroContent } from "./types";

/*
 * Home-section variant switchers.
 *
 * The page resolves an assignment to a variant id (lib/design/layouts) and
 * hands it here. The maps are the single place a layout id binds to a concrete
 * component; an unrecognised id falls back to the section default so a stale or
 * hand-edited revision degrades to the shipped look rather than crashing.
 */

export type { FamilyItem, HeroContent } from "./types";

const HERO_MAP = {
  editorial: HeroEditorial,
  centered: HeroCentered,
} as const;

const FAMILIES_MAP = {
  "broken-grid": FamiliesBrokenGrid,
  "uniform-grid": FamiliesUniformGrid,
} as const;

export function HomeHero({
  variant,
  content,
}: {
  variant: string;
  content: HeroContent;
}) {
  const Component =
    HERO_MAP[variant as keyof typeof HERO_MAP] ??
    HERO_MAP[DEFAULT_LAYOUT_VARIANTS["home.hero"] as keyof typeof HERO_MAP];
  return <Component content={content} />;
}

export function HomeFamilies({
  variant,
  items,
}: {
  variant: string;
  items: FamilyItem[];
}) {
  const Component =
    FAMILIES_MAP[variant as keyof typeof FAMILIES_MAP] ??
    FAMILIES_MAP[
      DEFAULT_LAYOUT_VARIANTS["home.families"] as keyof typeof FAMILIES_MAP
    ];
  return <Component items={items} />;
}
