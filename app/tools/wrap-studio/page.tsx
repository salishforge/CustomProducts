import type { CSSProperties } from "react";
import type { Metadata } from "next";
import WrapStudio from "@/components/wrap-studio/WrapStudio";

/*
 * Public tumbler-wrap designer. Everything runs client-side (Canvas API,
 * IndexedDB); no artwork leaves the browser. Customers get proofs only —
 * print-ready colour/white layers are staff-only at /admin/wrap-studio.
 *
 * lib/wrap/ and components/wrap-studio/ are vendored unchanged from
 * github.com/salishforge/wrap-studio (7eba83d). Make changes there first and
 * copy them across, so the standalone tool and the storefront don't drift.
 */

export const metadata: Metadata = {
  title: "Design a tumbler",
  description: "Lay out a glow-in-the-dark tumbler wrap from your own artwork and preview it in daylight and lights-out.",
};

// Wrap Studio reads --font-body; the storefront names its body face --font-sans.
const fontBridge = { "--font-body": "var(--font-sans)" } as CSSProperties;

export default function WrapStudioPage() {
  return (
    <div style={fontBridge}>
      <WrapStudio audience="customer" />
    </div>
  );
}
