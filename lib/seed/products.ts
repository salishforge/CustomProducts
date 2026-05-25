/*
 * Phase 1 seed: hand-curated product data so the catalog + PDP routes work
 * before the database is wired. Replaced in Phase 2 by the admin product
 * editor and Drizzle reads.
 */

export type SeedProduct = {
  slug: string;
  name: string;
  category: string;
  decoration: string;
  material: "laser" | "uv" | "crystal" | "leather" | "metal";
  basePriceCents: number;
  leadDays: number;
  dimensionsMm: string;
  shortDescription: string;
  fabrication: string;
};

export const seedProducts: SeedProduct[] = [
  {
    slug: "crystal-cube-80",
    name: "Crystal cube",
    category: "crystal_engraving",
    decoration: "Sub-surface laser",
    material: "crystal",
    basePriceCents: 12800,
    leadDays: 7,
    dimensionsMm: "80 × 80 × 80 mm",
    shortDescription:
      "An 80 mm optically-clear cube, engraved from the inside with a photo, logo, or hand-drawn line.",
    fabrication:
      "K9 optical crystal · 80 × 80 × 80 mm · sub-surface laser at 60 µm voxel pitch · felt-lined cherry box included.",
  },
  {
    slug: "tumbler-12oz-black",
    name: "12 oz tumbler",
    category: "drinkware",
    decoration: "UV print, full wrap",
    material: "uv",
    basePriceCents: 3400,
    leadDays: 5,
    dimensionsMm: "85 × 178 mm",
    shortDescription:
      "Powder-coated stainless tumbler with vacuum walls. Full 360° UV print wrap.",
    fabrication:
      "18/8 stainless · powder coat · UV-cured ink at 1440 DPI · dishwasher safe (top rack).",
  },
  {
    slug: "leather-patch-3x2",
    name: "Leather hat patch",
    category: "leather_patch",
    decoration: "Laser engrave",
    material: "leather",
    basePriceCents: 1200,
    leadDays: 4,
    dimensionsMm: "76 × 51 mm",
    shortDescription:
      "Vegetable-tanned leather patch with engraved art. Backed with iron-on adhesive.",
    fabrication:
      "4 mm veg-tan leather · engraved at 600 DPI, 8 mm/s, 45% power · heat-set adhesive backing.",
  },
  {
    slug: "dog-tag-mil",
    name: "Dog tag",
    category: "dog_tag",
    decoration: "Laser engrave",
    material: "metal",
    basePriceCents: 1600,
    leadDays: 4,
    dimensionsMm: "50 × 28 × 1 mm",
    shortDescription: "Stainless mil-spec tag, engraved on both faces.",
    fabrication:
      "304 stainless · 1 mm thick · 600 DPI engraving · ball-chain included.",
  },
  {
    slug: "bookmark-maple",
    name: "Maple bookmark",
    category: "bookmark",
    decoration: "Laser engrave",
    material: "laser",
    basePriceCents: 1400,
    leadDays: 4,
    dimensionsMm: "150 × 30 × 3 mm",
    shortDescription:
      "Solid maple bookmark with engraved art and a leather tassel.",
    fabrication: "Hard maple · 3 mm · finished with food-safe oil.",
  },
  {
    slug: "challenge-coin-40",
    name: "Challenge coin",
    category: "coin",
    decoration: "Laser engrave",
    material: "metal",
    basePriceCents: 1800,
    leadDays: 5,
    dimensionsMm: "40 × 3 mm",
    shortDescription: "Brass coin engraved on both faces. Carries well.",
    fabrication: "Solid brass · 40 mm diameter · engraved at 600 DPI.",
  },
  {
    slug: "deck-box-100",
    name: "Deck box — 100",
    category: "tcg_accessory",
    decoration: "UV print + laser cut",
    material: "uv",
    basePriceCents: 4400,
    leadDays: 6,
    dimensionsMm: "97 × 76 × 76 mm",
    shortDescription:
      "Holds 100 sleeved cards. UV-printed art with laser-cut accent panels.",
    fabrication: "5 mm birch ply · UV print on exterior · magnet-closed lid.",
  },
  {
    slug: "phone-case-iphone-16",
    name: "Phone case — iPhone 16",
    category: "phone_case",
    decoration: "UV print",
    material: "uv",
    basePriceCents: 3800,
    leadDays: 5,
    dimensionsMm: "iPhone 16 fit",
    shortDescription:
      "Slim TPU/PC hybrid case with UV-printed art, edge-to-edge.",
    fabrication: "TPU bumper + PC shell · UV-cured ink with clear top-coat.",
  },
];

export function getProductBySlug(slug: string): SeedProduct | undefined {
  return seedProducts.find((p) => p.slug === slug);
}
