/*
 * Typography registration.
 *
 * Default ladder (preloaded — drives LCP on every page):
 *   Display  — Fraunces (variable, opsz + wght + soft + wonk axes)
 *   Body/UI  — Inter Tight (variable, wght axis)
 *   Mono     — JetBrains Mono (variable, wght)
 *
 * The remaining faces are the Design Console's alternate-pairing catalog
 * (lib/design/font-pairings). They are NOT preloaded: their CSS variables
 * are registered on <html> so a theme revision can point --font-display /
 * --font-sans / --font-mono at them via a single variable swap, but the font
 * files only download when a revision actually selects them. Keeping the
 * default ladder as the only preload protects LCP for the shipped theme.
 *
 * This is the open-source fallback. To upgrade to the licensed brand pairing
 * (GT Sectra + Söhne), drop the woff2 files under `public/fonts/`, replace
 * the `next/font/google` imports with `next/font/local` declarations
 * pointing to those files, and keep the exported variable names — every
 * downstream consumer reads them via the CSS variables in globals.css.
 */

import {
  Fraunces,
  Hanken_Grotesk,
  Inter_Tight,
  JetBrains_Mono,
  Newsreader,
  Source_Serif_4,
  Spline_Sans_Mono,
} from "next/font/google";

export const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
  weight: "variable",
  preload: true,
});

export const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
  weight: "variable",
  preload: true,
});

export const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: "variable",
  preload: false,
});

// --- Alternate catalog (Design Console pairings; not preloaded) ---

export const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  axes: ["opsz"],
  weight: "variable",
  preload: false,
});

export const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
  axes: ["opsz"],
  weight: "variable",
  preload: false,
});

export const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
  weight: "variable",
  preload: false,
});

export const splineSansMono = Spline_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-spline-mono",
  display: "swap",
  weight: "variable",
  preload: false,
});

export const fontVariables = [
  fraunces.variable,
  interTight.variable,
  jetBrainsMono.variable,
  newsreader.variable,
  sourceSerif.variable,
  hankenGrotesk.variable,
  splineSansMono.variable,
].join(" ");
