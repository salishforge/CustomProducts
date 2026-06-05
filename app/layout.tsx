import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import "./globals.css";
import { fontVariables } from "./fonts";
import { getActiveTheme } from "@/lib/theme/resolve";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://salishforge.com"),
  title: {
    default: "Salishforge — Forged customs",
    template: "%s · Salishforge",
  },
  description:
    "Laser engraved, UV printed, and inner-crystal etched goods. Customized one at a time.",
  applicationName: "Salishforge",
  appleWebApp: { capable: true, title: "Salishforge", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#fbf6ef",
  initialScale: 1,
  width: "device-width",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // SSR-resolve the active theme revision (Phase 4 Design Console hook). When
  // no revision is set, defaultTheme() returns the Tailwind v4 @theme
  // defaults verbatim — the inline style block is a no-op in that case.
  const theme = await getActiveTheme();
  const styleVars = theme.cssVars as unknown as CSSProperties;

  return (
    <html lang="en" className={fontVariables} style={styleVars}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
