/*
 * SSR theme resolver.
 *
 * Reads the current active_theme_revision_id from site_settings (cached via
 * unstable_cache tagged 'theme'), loads the revision, composes the runtime
 * CSS variable map. Returns sane defaults when no revision is active so the
 * site is never blank during a config gap.
 *
 * Applied at app/layout.tsx by setting the CSS variables on <html style={...}>.
 * Falls back to the Tailwind v4 @theme defaults in globals.css when a
 * revision doesn't override a particular token.
 */

import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { db } from "@/lib/db/client";
import { siteSettings, themeRevisions } from "@/drizzle/schema";

import {
  FONT_PAIRING_BY_ID,
  type FontPairing,
} from "@/lib/design/font-pairings";
import { PALETTE_BY_ID, type Palette } from "@/lib/design/palettes";
import { SPACING_BY_ID, type SpacingScale } from "@/lib/design/spacing";
import type { ThemeRevisionTokens } from "@/lib/design/brand-rules";

export type ResolvedTheme = {
  revisionId: string | null;
  palette: Palette;
  fontPairing: FontPairing;
  spacingScale: SpacingScale;
  /** Per-section layout variant ids (lib/design/layouts). Empty = all defaults. */
  layoutAssignments: Record<string, string>;
  cssVars: Record<string, string>;
};

const DEFAULT_PALETTE_ID = "forge-default";
const DEFAULT_FONT_PAIRING_ID = "fraunces-inter-jb";
const DEFAULT_SPACING_ID = "current";

function composeCssVars(
  palette: Palette,
  font: FontPairing,
  spacing: SpacingScale,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(palette.tokens)) {
    vars[`--color-${k}`] = v;
  }
  vars["--font-display"] = font.displayCssVar;
  vars["--font-sans"] = font.bodyCssVar;
  vars["--font-mono"] = font.monoCssVar;
  for (const [k, v] of Object.entries(spacing.tokens)) {
    vars[`--${k}`] = v;
  }
  vars["--leading-display"] = String(spacing.leading.display);
  vars["--leading-heading"] = String(spacing.leading.heading);
  vars["--leading-body"] = String(spacing.leading.body);
  vars["--leading-mono"] = String(spacing.leading.mono);
  return vars;
}

function resolveFromIds(tokens: ThemeRevisionTokens): ResolvedTheme {
  const palette = PALETTE_BY_ID[tokens.palette_id] ?? PALETTE_BY_ID[DEFAULT_PALETTE_ID]!;
  const fontPairing =
    FONT_PAIRING_BY_ID[tokens.font_pairing_id] ?? FONT_PAIRING_BY_ID[DEFAULT_FONT_PAIRING_ID]!;
  const spacingScale =
    SPACING_BY_ID[tokens.spacing_scale_id] ?? SPACING_BY_ID[DEFAULT_SPACING_ID]!;
  return {
    revisionId: null,
    palette,
    fontPairing,
    spacingScale,
    layoutAssignments: tokens.layout_assignments ?? {},
    cssVars: composeCssVars(palette, fontPairing, spacingScale),
  };
}

export function defaultTheme(): ResolvedTheme {
  return resolveFromIds({
    palette_id: DEFAULT_PALETTE_ID,
    font_pairing_id: DEFAULT_FONT_PAIRING_ID,
    spacing_scale_id: DEFAULT_SPACING_ID,
  });
}

export const getActiveTheme = unstable_cache(
  async (): Promise<ResolvedTheme> => {
    // active_theme_revision_id may be unset (KV row absent) — the site_settings
    // helper would normally cover this but we read directly here to avoid
    // a cache-key cascade through getSiteSetting.
    const [pointerRow] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, "active_theme_revision_id"))
      .limit(1);
    if (!pointerRow) return defaultTheme();
    const revisionId =
      typeof pointerRow.value === "string"
        ? pointerRow.value
        : null;
    if (!revisionId) return defaultTheme();

    const [revision] = await db
      .select()
      .from(themeRevisions)
      .where(eq(themeRevisions.id, revisionId))
      .limit(1);
    if (!revision) return defaultTheme();

    const tokens = revision.tokens as ThemeRevisionTokens;
    const resolved = resolveFromIds(tokens);
    return { ...resolved, revisionId };
  },
  ["theme", "active"],
  { tags: ["theme", "settings"], revalidate: 60 },
);
