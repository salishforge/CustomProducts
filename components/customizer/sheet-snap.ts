/*
 * Bottom-sheet snap math.
 *
 * The customizer's mobile rails are bottom-sheets that rest at three heights
 * (peek / half / full = 12 / 48 / 92 dvh, per the plan). Two surfaces need to
 * agree on those heights: the drag handle (resolve a released drag to the
 * nearest snap, or dismiss) and the tab launcher (open at half, cycle on tap).
 * Keeping the math here — pure, DOM-free — lets both share it and lets the
 * snap resolution be unit-tested without a browser.
 */

export type SnapLevel = "peek" | "half" | "full";

export const SNAP_VH: Record<SnapLevel, number> = {
  peek: 12,
  half: 48,
  full: 92,
};

const ORDER: readonly SnapLevel[] = ["peek", "half", "full"];

/** Below this height a released drag dismisses the sheet rather than snapping. */
const DISMISS_BELOW_VH = 6;

/** Resolve a released drag height (in dvh) to the nearest snap, or "dismiss". */
export function resolveSnap(vh: number): SnapLevel | "dismiss" {
  if (vh < DISMISS_BELOW_VH) return "dismiss";
  let best: SnapLevel = "peek";
  let bestDistance = Infinity;
  for (const level of ORDER) {
    const distance = Math.abs(vh - SNAP_VH[level]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = level;
    }
  }
  return best;
}

/** Advance peek → half → full → peek, for tap-to-cycle on the handle. */
export function cycleSnap(current: SnapLevel): SnapLevel {
  const index = ORDER.indexOf(current);
  return ORDER[(index + 1) % ORDER.length]!;
}
