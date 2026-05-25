/*
 * Motion presets.
 *
 * Three named springs and a strict duration scale. The discipline of having
 * a small fixed vocabulary is what keeps motion feeling composed instead of
 * decorative.
 *
 * Springs are physics objects (Motion / Framer Motion v12+ shape). Eases are
 * cubic-bezier control points for plain CSS transitions where a spring would
 * be overkill. Durations are quantized; nothing in between.
 *
 * Reduced motion: when the user prefers reduced motion, use `withReducedMotion`
 * to swap springs for the knife ease at the fast duration.
 */

export type Spring = {
  type: "spring";
  stiffness: number;
  damping: number;
  mass: number;
};

export const spring = {
  /** UI controls, button presses — crisp, no overshoot. */
  firm: { type: "spring", stiffness: 380, damping: 32, mass: 0.6 } as const,
  /** Panel slides, drawer reveals — relaxed but purposeful. */
  soft: { type: "spring", stiffness: 180, damping: 26, mass: 0.9 } as const,
  /** Brand signature — gentle bounce-overshoot for one-off display moments. */
  amber: { type: "spring", stiffness: 240, damping: 18, mass: 0.7 } as const,
} satisfies Record<string, Spring>;

export const duration = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
  slower: 0.52,
  slowest: 0.84,
} as const;

export const ease = {
  /** Workhorse — ~600ms feels luxurious without dragging. */
  outCraft: [0.16, 1, 0.3, 1] as const,
  /** Reveals where the destination is the point. */
  inOutKnife: [0.83, 0, 0.17, 1] as const,
  /** Short (150ms) press feedback. */
  outThumb: [0.22, 0.61, 0.36, 1] as const,
};

/** Detect prefers-reduced-motion at call site. SSR-safe — returns false on the server. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Wrap any transition with a reduced-motion fallback. The fallback collapses
 * the spring to a 120ms knife ease.
 */
export function withReducedMotion<T extends object>(
  transition: T,
): T | { duration: number; ease: readonly number[] } {
  if (prefersReducedMotion()) {
    return { duration: duration.fast, ease: ease.inOutKnife };
  }
  return transition;
}
