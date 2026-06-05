/*
 * Curated palettes for the Design Console.
 *
 * Every palette ships a full OKLCH ramp covering the eight neutrals
 * (paper-50..ink-950), the four-step ember accent, and the five material
 * tokens. Add a new palette by appending to PALETTES; the registry is
 * append-only (rollback via theme_revisions, not by removing palettes).
 *
 * The brand rule "one accent color only" is enforced at validate-time:
 * a palette cannot expose a second chromatic ramp.
 */

export type PaletteTokens = {
  "paper-50": string;
  "paper-100": string;
  "paper-200": string;
  "paper-300": string;
  "ink-400": string;
  "ink-600": string;
  "ink-800": string;
  "ink-950": string;
  "ember-300": string;
  "ember-500": string;
  "ember-700": string;
  "ember-900": string;
  "mat-laser": string;
  "mat-uv": string;
  "mat-crystal": string;
  "mat-leather": string;
  "mat-metal": string;
};

export type Palette = {
  id: string;
  name: string;
  description: string;
  /** Brand accent hue band the palette sits in (30–50 = warm copper). */
  accentHueBand: [number, number];
  tokens: PaletteTokens;
};

export const PALETTES: Palette[] = [
  {
    id: "forge-default",
    name: "Forge default",
    description: "Warm paper, graphite ink, molten copper. The currently shipped look.",
    accentHueBand: [38, 38],
    tokens: {
      "paper-50":  "oklch(98.5% 0.004 85)",
      "paper-100": "oklch(97% 0.006 85)",
      "paper-200": "oklch(94% 0.008 85)",
      "paper-300": "oklch(90% 0.010 85)",
      "ink-400":   "oklch(68% 0.010 80)",
      "ink-600":   "oklch(48% 0.012 75)",
      "ink-800":   "oklch(28% 0.014 70)",
      "ink-950":   "oklch(14% 0.012 70)",
      "ember-300": "oklch(82% 0.10 40)",
      "ember-500": "oklch(68% 0.18 38)",
      "ember-700": "oklch(52% 0.15 36)",
      "ember-900": "oklch(38% 0.12 35)",
      "mat-laser":   "oklch(72% 0.04 70)",
      "mat-uv":      "oklch(76% 0.08 230)",
      "mat-crystal": "oklch(85% 0.05 220)",
      "mat-leather": "oklch(38% 0.05 50)",
      "mat-metal":   "oklch(62% 0.01 250)",
    },
  },
  {
    id: "workshop-dusk",
    name: "Workshop dusk",
    description: "Deeper neutrals, dusk paper, the same copper accent at lower chroma. For evening / dimly-lit display contexts.",
    accentHueBand: [35, 35],
    tokens: {
      "paper-50":  "oklch(95% 0.006 80)",
      "paper-100": "oklch(92% 0.008 80)",
      "paper-200": "oklch(88% 0.010 80)",
      "paper-300": "oklch(82% 0.012 80)",
      "ink-400":   "oklch(60% 0.012 75)",
      "ink-600":   "oklch(42% 0.014 70)",
      "ink-800":   "oklch(24% 0.016 65)",
      "ink-950":   "oklch(10% 0.014 65)",
      "ember-300": "oklch(75% 0.08 36)",
      "ember-500": "oklch(60% 0.14 35)",
      "ember-700": "oklch(46% 0.12 34)",
      "ember-900": "oklch(32% 0.10 33)",
      "mat-laser":   "oklch(66% 0.04 70)",
      "mat-uv":      "oklch(70% 0.07 230)",
      "mat-crystal": "oklch(78% 0.05 220)",
      "mat-leather": "oklch(34% 0.05 50)",
      "mat-metal":   "oklch(56% 0.01 250)",
    },
  },
  {
    id: "salt-rime",
    name: "Salt rime",
    description: "Bluer, cooler neutrals. The accent shifts to a quieter rust to remain warm-band-compliant.",
    accentHueBand: [42, 42],
    tokens: {
      "paper-50":  "oklch(98.5% 0.005 240)",
      "paper-100": "oklch(96% 0.007 240)",
      "paper-200": "oklch(93% 0.009 240)",
      "paper-300": "oklch(88% 0.011 240)",
      "ink-400":   "oklch(64% 0.010 240)",
      "ink-600":   "oklch(46% 0.012 240)",
      "ink-800":   "oklch(26% 0.014 240)",
      "ink-950":   "oklch(12% 0.012 240)",
      "ember-300": "oklch(80% 0.10 42)",
      "ember-500": "oklch(66% 0.16 42)",
      "ember-700": "oklch(50% 0.14 40)",
      "ember-900": "oklch(36% 0.12 38)",
      "mat-laser":   "oklch(72% 0.04 70)",
      "mat-uv":      "oklch(76% 0.08 230)",
      "mat-crystal": "oklch(85% 0.05 220)",
      "mat-leather": "oklch(38% 0.05 50)",
      "mat-metal":   "oklch(62% 0.01 250)",
    },
  },
  {
    id: "kiln-light",
    name: "Kiln light",
    description: "Brighter paper, slightly hotter accent. For sunny showroom contexts; pushes the accent without leaving the warm band.",
    accentHueBand: [32, 32],
    tokens: {
      "paper-50":  "oklch(99% 0.003 85)",
      "paper-100": "oklch(98% 0.005 85)",
      "paper-200": "oklch(96% 0.007 85)",
      "paper-300": "oklch(92% 0.009 85)",
      "ink-400":   "oklch(70% 0.010 80)",
      "ink-600":   "oklch(50% 0.012 75)",
      "ink-800":   "oklch(30% 0.014 70)",
      "ink-950":   "oklch(16% 0.012 70)",
      "ember-300": "oklch(84% 0.12 32)",
      "ember-500": "oklch(70% 0.20 32)",
      "ember-700": "oklch(54% 0.18 30)",
      "ember-900": "oklch(40% 0.15 28)",
      "mat-laser":   "oklch(74% 0.05 70)",
      "mat-uv":      "oklch(78% 0.08 230)",
      "mat-crystal": "oklch(86% 0.05 220)",
      "mat-leather": "oklch(40% 0.06 50)",
      "mat-metal":   "oklch(64% 0.01 250)",
    },
  },
];

export const PALETTE_BY_ID: Record<string, Palette> = Object.fromEntries(
  PALETTES.map((p) => [p.id, p]),
);
