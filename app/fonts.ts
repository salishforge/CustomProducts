/*
 * Typography registration.
 *
 * Ladder:
 *   Display  — Fraunces (variable, opsz + wght + soft + wonk axes)
 *   Body/UI  — Inter Tight (variable, wght axis)
 *   Mono     — JetBrains Mono (variable, wght)
 *
 * This is the open-source fallback. To upgrade to the licensed brand pairing
 * (GT Sectra + Söhne), drop the woff2 files under `public/fonts/`, replace
 * the `next/font/google` imports with `next/font/local` declarations
 * pointing to those files, and keep the exported variable names — every
 * downstream consumer reads them via the CSS variables in globals.css.
 */

import { Fraunces, Inter_Tight, JetBrains_Mono } from "next/font/google";

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

export const fontVariables = [
  fraunces.variable,
  interTight.variable,
  jetBrainsMono.variable,
].join(" ");
