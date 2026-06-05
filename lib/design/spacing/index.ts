/*
 * Curated spacing scales.
 *
 * Each scale exports the eight discrete spacing tokens consumed by
 * globals.css. The validator enforces "body line-height ≥ 1.5" by requiring
 * scales to declare leadingBody ≥ 1.5.
 */

export type SpacingScale = {
  id: string;
  name: string;
  description: string;
  baseRem: number;
  /** Replace the global --spacing-* tokens. Same keys as in globals.css. */
  tokens: {
    "spacing-1": string;
    "spacing-2": string;
    "spacing-3": string;
    "spacing-4": string;
    "spacing-5": string;
    "spacing-6": string;
    "spacing-8": string;
    "spacing-10": string;
    "spacing-14": string;
    "spacing-18": string;
    "spacing-24": string;
    "spacing-32": string;
    "spacing-42": string;
  };
  leading: {
    display: number;
    heading: number;
    body: number;
    mono: number;
  };
};

export const SPACING_SCALES: SpacingScale[] = [
  {
    id: "current",
    name: "Default",
    description: "The currently shipped 4 px base with Fibonacci-adjacent breaks above 32 px.",
    baseRem: 0.25,
    tokens: {
      "spacing-1": "0.25rem",
      "spacing-2": "0.5rem",
      "spacing-3": "0.75rem",
      "spacing-4": "1rem",
      "spacing-5": "1.25rem",
      "spacing-6": "1.5rem",
      "spacing-8": "2rem",
      "spacing-10": "2.5rem",
      "spacing-14": "3.5rem",
      "spacing-18": "4.5rem",
      "spacing-24": "6rem",
      "spacing-32": "8rem",
      "spacing-42": "10.5rem",
    },
    leading: { display: 1.05, heading: 1.15, body: 1.6, mono: 1.4 },
  },
  {
    id: "tighter",
    name: "Tighter",
    description: "Same scale base, slightly less generous between sections — for catalogs and admin density.",
    baseRem: 0.25,
    tokens: {
      "spacing-1": "0.25rem",
      "spacing-2": "0.5rem",
      "spacing-3": "0.625rem",
      "spacing-4": "0.875rem",
      "spacing-5": "1.125rem",
      "spacing-6": "1.375rem",
      "spacing-8": "1.75rem",
      "spacing-10": "2.25rem",
      "spacing-14": "3rem",
      "spacing-18": "4rem",
      "spacing-24": "5rem",
      "spacing-32": "7rem",
      "spacing-42": "9rem",
    },
    leading: { display: 1.05, heading: 1.15, body: 1.55, mono: 1.35 },
  },
  {
    id: "generous",
    name: "Generous",
    description: "Larger negative space throughout. For showroom/editorial showcases.",
    baseRem: 0.25,
    tokens: {
      "spacing-1": "0.25rem",
      "spacing-2": "0.625rem",
      "spacing-3": "1rem",
      "spacing-4": "1.25rem",
      "spacing-5": "1.625rem",
      "spacing-6": "2rem",
      "spacing-8": "2.625rem",
      "spacing-10": "3.25rem",
      "spacing-14": "4.5rem",
      "spacing-18": "6rem",
      "spacing-24": "8rem",
      "spacing-32": "10.5rem",
      "spacing-42": "13rem",
    },
    leading: { display: 1.05, heading: 1.2, body: 1.7, mono: 1.45 },
  },
];

export const SPACING_BY_ID: Record<string, SpacingScale> = Object.fromEntries(
  SPACING_SCALES.map((s) => [s.id, s]),
);
