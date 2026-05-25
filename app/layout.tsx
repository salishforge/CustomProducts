import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontVariables } from "./fonts";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
