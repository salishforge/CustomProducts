import type { CSSProperties } from "react";
import WrapStudio from "@/components/wrap-studio/WrapStudio";

/*
 * Staff Wrap Studio: the customer tool plus colour / white-underbase layer
 * export for the UV printer. Admin-gated by app/admin/layout.tsx.
 */

// Wrap Studio reads --font-body; the storefront names its body face --font-sans.
const fontBridge = { "--font-body": "var(--font-sans)" } as CSSProperties;

export default function AdminWrapStudioPage() {
  return (
    <div style={fontBridge}>
      <WrapStudio audience="staff" />
    </div>
  );
}
