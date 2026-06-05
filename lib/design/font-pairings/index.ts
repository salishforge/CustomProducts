/*
 * Curated (display, body, mono) font pairings.
 *
 * The Design Console picks from this set. New pairings require both a code
 * change here AND a registration in app/fonts.ts (so next/font subsets and
 * preloads). The validator enforces "display must be a serif" via the
 * `displayIsSerif` flag.
 *
 * MVP ships with the three Google Fonts loaded in app/fonts.ts:
 * Fraunces (display serif), Inter Tight (body sans), JetBrains Mono.
 * Additional pairings extend the catalog once their fonts ship.
 */

export type FontPairing = {
  id: string;
  name: string;
  /** Display name shown in the Console picker. */
  displayLabel: string;
  /** CSS variable refs; resolved by globals.css to actual font-family strings. */
  displayCssVar: string;
  bodyCssVar: string;
  monoCssVar: string;
  displayIsSerif: boolean;
  description: string;
};

export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: "fraunces-inter-jb",
    name: "Forge default",
    displayLabel: "Fraunces · Inter Tight · JetBrains Mono",
    displayCssVar: "var(--font-fraunces)",
    bodyCssVar: "var(--font-inter-tight)",
    monoCssVar: "var(--font-jetbrains-mono)",
    displayIsSerif: true,
    description: "Variable serif (opsz + SOFT + WONK axes) paired with a tight humanist sans and a precise mono. The currently shipped pairing.",
  },
  {
    id: "fraunces-display-only",
    name: "All-Fraunces",
    displayLabel: "Fraunces · Fraunces · JetBrains Mono",
    displayCssVar: "var(--font-fraunces)",
    bodyCssVar: "var(--font-fraunces)",
    monoCssVar: "var(--font-jetbrains-mono)",
    displayIsSerif: true,
    description: "Editorial extremis — body in the same serif as display at smaller optical sizes. Use sparingly; can feel precious on long pages.",
  },
  {
    id: "inter-only-display-fraunces",
    name: "Quiet sans body",
    displayLabel: "Fraunces · Inter Tight · Inter Tight",
    displayCssVar: "var(--font-fraunces)",
    bodyCssVar: "var(--font-inter-tight)",
    monoCssVar: "var(--font-inter-tight)",
    displayIsSerif: true,
    description: "Sans for everything but the display moments — including SKUs and prices. Drops the mono register; choose only when the workshop-floor specificity isn't a priority.",
  },
];

export const FONT_PAIRING_BY_ID: Record<string, FontPairing> = Object.fromEntries(
  FONT_PAIRINGS.map((p) => [p.id, p]),
);
